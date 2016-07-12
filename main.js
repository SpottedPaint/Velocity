const electron = require('electron');
var sqlite3 = require('sqlite3').verbose();
var moment = require('moment');
// Module to control application life.
const app = electron.app
const ipcMain = electron.ipcMain;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow
const Tray = electron.Tray
const Menu = electron.Menu
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let onlineStatusWindow;
let appIcon = null;


/* setup db if it doesn't exist */
var db = new sqlite3.Database(__dirname + '/velocity.db');

db.serialize(function() {
	db.run("CREATE TABLE if not exists timesheet (id INTEGER PRIMARY KEY ASC,hash,startDateTime,endDateTime,projectId INTEGER,deleted INTEGER DEFAULT 0)");
	db.run("CREATE TABLE if not exists project (id INTEGER PRIMARY KEY ASC,hash,title,parentId INTEGER,priority INTEGER DEFAULT 0,deleted INTEGER DEFAULT 0)");
});
//db.close();

function createWindow () {
	// Create the browser window.
	mainWindow = new BrowserWindow({width: 1200, height: 600}); //, frame: false});

	// and load the index.html of the app.
	mainWindow.loadURL(`file://${__dirname}/index.html`)

	// Open the DevTools.
	mainWindow.webContents.openDevTools()

	// Emitted when the window is closed.
	mainWindow.on('closed', function () {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null
	})


	var trayImage;
	var imageFolder = __dirname + '/assets/images';

	// Determine appropriate icon for platform
	trayImage = imageFolder + '/osx/trayTemplate.png';

	appIcon = new Tray(trayImage);
	//appIcon.setPressedImage(imageFolder + '/osx/trayHighlight.png');
	const contextMenu = Menu.buildFromTemplate([
		{label: 'Quit',accelerator: 'CmdOrCtrl+Q', click() { app.quit(); } },
		{label: 'Toggle Full Screen',
			accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
			click(item, focusedWindow) {
				if (focusedWindow){
					focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
				}
			}
		},
		{
			label: 'Minimize',
			accelerator: 'CmdOrCtrl+M',
			role: 'minimize'
		},
		{
			label: 'Close',
			accelerator: 'CmdOrCtrl+W',
			role: 'close'
		}


	]);
	appIcon.setToolTip('This is my application.');

	appIcon.setContextMenu(contextMenu);
	//app.dock.hide();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

ipcMain.on('online-status-changed', (event, status) => {
	//console.log(status);
});

app.on('ready', () => {
	require('electron').powerMonitor.on('suspend', () => {
		console.log('The system is going to sleep');
	});
});
/*
const {app, Menu, Tray} = require('electron');

let appIcon = null;
app.on('ready', () => {
  appIcon = new Tray('/path/to/my/icon');
  const contextMenu = Menu.buildFromTemplate([
    {label: 'Item1', type: 'radio'},
    {label: 'Item2', type: 'radio'},
    {label: 'Item3', type: 'radio', checked: true},
    {label: 'Item4', type: 'radio'}
  ]);
  appIcon.setToolTip('This is my application.');
  appIcon.setContextMenu(contextMenu);
});
*/
//


// Quit when all windows are closed.
app.on('window-all-closed', function () {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('activate', function () {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow()
	}
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.




ipcMain.on('listAllTimeSheetRows', function(event, projectId, from, to ){
	// was for days but if over 24 hours was 00
	// CAST(( (strftime('%s', endDateTime) - strftime('%s', startDateTime)) % (60 * 60 * 24)) / (60 * 60) AS TEXT)
	var from = from+' 00:00:00',
		to = to+' 23:69:59';
	//console.log(projectId, from, to);
	db.each("SELECT id,hash,startDateTime,endDateTime, CAST(( (strftime('%s', endDateTime) - strftime('%s', startDateTime)) / (60 * 60)) AS TEXT)|| ':' || CAST((((strftime('%s', endDateTime) - strftime('%s', startDateTime)) % (60 * 60 * 24)) % (60 * 60)) / 60 AS TEXT) || ':' || CAST((((strftime('%s', endDateTime) - strftime('%s', startDateTime)) % (60 * 60 * 24)) % (60 * 60)) % (60) AS TEXT) as timeSpan, projectId \
	FROM timesheet \
	WHERE id IN ( \
\
		SELECT id FROM ( \
			SELECT id, 1 as priority \
			FROM timesheet \
			WHERE deleted != 1 AND projectId = ? \
			AND strftime(startDateTime) BETWEEN strftime('"+from+"') AND strftime('"+to+"') \
	\
			UNION \
	\
			SELECT 0 as id, 2 as priority FROM timesheet \
	\
			ORDER BY priority \
		) \
	) \
\
	GROUP BY id",[projectId], function(err, row){
		if(err) {
			console.log((new Error()).stack.split("\n")[1].split(':')[1], "listAllTimeSheetRows",  err, "{", row.id, ",", row.startDateTime, ",", row.endDateTime, ",", row.timeSpan, ",", projectId, "}" );
		}else{
			event.sender.send('timesheetItemRetrieved', row.id, row.startDateTime, row.endDateTime, row.timeSpan, projectId);
		}
	});

});

ipcMain.on('deleteTimesheetItem', function(event,id){

	db.run("UPDATE timesheet SET deleted = 1 WHERE id = ?", [id],
		function(err){
			console.log((new Error()).stack.split("\n")[1].split(':')[1], "deleteTimesheetItem",  err, "{", id, "}" );
		}
	);
	db.each("SELECT projectId FROM timesheet WHERE id = ?", [id],
	function(err, row) {
		if(err) {
			console.log((new Error()).stack.split("\n")[1].split(':')[1], "deleteTimesheetItem",  err, "{", id, "}" );
		}else{
			event.sender.send('timesheetItemUpdated', row.projectId);
		}
	});

});

ipcMain.on('updateTimesheetItem', function(event,hash,startDateTime,endDateTime,id){
	db.run("UPDATE timesheet SET hash = ? ,startDateTime = ? ,endDateTime = ? WHERE id = ? ", [hash,startDateTime,endDateTime,id],
		function(err){
			if(err){
				console.log((new Error()).stack.split("\n")[1].split(':')[1], "updateTimesheetItem",  err, "{", hash, "," , startDateTime, ",", endDateTime, ",", id, ",", "}" );
			}
		}
	);

	db.each("SELECT projectId FROM timesheet WHERE id = ?", [id],
		function(err, row) {
			if(err) {
				console.log((new Error()).stack.split("\n")[1].split(':')[1], "updateTimesheetItem",  err, "{", id, "," ,row.projectId, "}" );
			}else{
				event.sender.send('timesheetItemUpdated', row.projectId);
			}
		}
	);
});

ipcMain.on('addTimesheetItem', function(event,hash,startDateTime,endDateTime,projectId){

	db.serialize(function() {
		db.run("INSERT INTO timesheet (hash,startDateTime,endDateTime,projectId) VALUES (?,?,?,?)", [hash,startDateTime,endDateTime,projectId],
			function(err){
					if(err){
						console.log((new Error()).stack.split("\n")[1].split(':')[1], "addTimesheetItem",  err, "{", hash, "," , startDateTime, ",", endDateTime, ",", projectId, "}" );
					}
			}
		);
		db.each("SELECT rowId AS id, hash, startDateTime, endDateTime, projectId, CAST(( (strftime('%s', endDateTime) - strftime('%s', startDateTime)) / (60 * 60)) AS TEXT) || ':' || CAST((((strftime('%s', endDateTime) - strftime('%s', startDateTime)) % (60 * 60 * 24)) % (60 * 60)) / 60 AS TEXT) || ':' || CAST((((strftime('%s', endDateTime) - strftime('%s', startDateTime)) % (60 * 60 * 24)) % (60 * 60)) % (60) AS TEXT) as timeSpan FROM timesheet ORDER BY ID DESC LIMIT 1",
		function(err, row) {
			if(err) {
				console.log((new Error()).stack.split("\n")[1].split(':')[1], "addTimesheetItem",  err, "{", hash, "," , startDateTime, ",", projectId, "}" );
			}else{
				event.sender.send('timesheetItemAdded', row.id, row.startDateTime, row.endDateTime, row.timeSpan, row.projectId);
			}
		});
	});

});

/* create spreadheet */

function getFileName(projectId, from, to, extension){

	/*
	getProjectTitle()
	return projectTitle+from+to+'.'+ext
	*/
}
ipcMain.on('getTotalForDateSpan',function(event,projectId, from, to){
	getTotalForDateSpan(event, projectId, from, to);
});

function getTotalForDateSpan(event, projectId, from, to){
	/* childIds as well */
	//db.serialize(function() {
	var from = from+' 00:00:00',
		to = to+' 23:59:59';
		//
	//console.log(projectId, from, to);

// ORDER BY projectId DESC \
	//
	db.get("SELECT  round(SUM(timeSpan) / 3600,2) as sum, projectId FROM \
	( \
		SELECT projectId, CAST(strftime('%s', endDateTime) - strftime('%s', startDateTime) AS REAL) as timeSpan, 1 as priority \
		FROM timesheet \
		WHERE deleted != 1 AND projectId = ? \
		AND strftime(startDateTime) BETWEEN strftime('"+from+"') AND strftime('"+to+"') \
\
		UNION \
\
		SELECT ? as projectId, 0 as timeSpan, 2 as priority FROM timesheet \
\
		ORDER BY priority \
	) \
	GROUP BY projectId",[projectId,projectId],
		function(err, row) {
			if(err) {
				console.log((new Error()).stack.split("\n")[1].split(':')[1], "getTotalForDateSpan",  err, "{", from, ",", to, ",", row.sum, "," ,row.projectId, ",", projectId, "}" );
			}else{
				event.sender.send('newTimesheetTotal', row.sum, row.projectId);
			}
		}
	);

}

ipcMain.on('getTimeOnProjectBetween',function(event, id, projectId, from, to){
//GROUP by timesheet.id \
	db.get("SELECT round(SUM(timeSpan) / 3600,6) as sum, projectId FROM(\
\
	SELECT id, projectId, CAST(strftime('%s', endDateTime) - strftime('%s', startDateTime) AS REAL) as timeSpan, 1 as priority \
	FROM timesheet WHERE deleted != 1 AND projectId = ? AND strftime(startDateTime) BETWEEN strftime('"+from+"') AND strftime('"+to+"') \
	GROUP by timesheet.id \
\
	UNION \
\
	SELECT 0 as id, ? as projectId, 0 as timeSpan, 2 as priority FROM timesheet \
\
	ORDER BY priority \
\
	)",[projectId, projectId],
		function(err, row) {
			if(err) {
				console.log((new Error()).stack.split("\n")[1].split(':')[1], "getTimeOnProjectBetween",  err, "{", id, ",", projectId, ",", from, ",", to , "}" );
			}else{
				event.sender.send('projectTimeBetween', id, row.sum);
			}
		}
	);
});


/*
SELECT round(SUM(timeSpan) / 3600,6) as sum, projectId FROM(
	SELECT id, projectId, CAST(strftime('%s', endDateTime) - strftime('%s', startDateTime) AS REAL) as timeSpan, 1 as priority FROM timesheet WHERE deleted != 1 AND projectId = 191
  GROUP by timesheet.id
	UNION
	SELECT 0 as id, ? as projectId, 0 as timeSpan, 2 as priority FROM timesheet
	ORDER BY priority
)
*/

ipcMain.on('getTotalTimeOnProjectBetween',function(event, id, projectId, from, to){

	db.get(" \
\
	SELECT round(SUM(timeSpan) / 3600,6) as sum, projectId FROM \
	( \
		SELECT id, projectId, CAST(strftime('%s', endDateTime) - strftime('%s', startDateTime) AS REAL) as timeSpan, 1 as priority \
		FROM timesheet \
		WHERE deleted != 1 AND projectId IN ( \
			WITH RECURSIVE \
			related(n) AS \
			( \
				VALUES(?) \
				UNION \
				SELECT id FROM project, related \
				WHERE project.parentId=related.n \
			) \
			SELECT id FROM project WHERE project.id IN related \
		) \
 \
	AND strftime(startDateTime) BETWEEN strftime('"+from+"') AND strftime('"+to+"') \
		GROUP by timesheet.id \
\
	UNION \
\
	SELECT 0 as id, ? as projectId, 0 as timeSpan, 2 as priority FROM timesheet \
\
	ORDER BY priority \
	)",[projectId, projectId],
		function(err, row) {
			if(err) {
				console.log((new Error()).stack.split("\n")[1].split(':')[1], "getTotalTimeOnProjectBetween",  err, "{", id, ",", projectId, ",", from, ",", to , "}" );
			}else{
				event.sender.send('projectTimeBetween', id, row.sum);
			}
		}
	);
});


/*

SELECT projectId from project WHERE parentId = 186
SELECT ? as projectId, 3600 as timeSpan FROM timesheet \
		SELECT projectId, CAST(strftime('%s', endDateTime) - strftime('%s', startDateTime) AS REAL) as timeSpan FROM timesheet WHERE projectId >= 0 AND deleted != 1 AND projectId = ? AND strftime(startDateTime) BETWEEN strftime('"+from+"') AND strftime('"+to+"')\
		ORDER BY projectId DESC\
*/

function createSpreadSheet(projectId, from, to){
	/* get projects and child projects to include */

	/* get days between from and to */

	/*
	foreach ( projects as project ){

		foreach( days as day ){

			get timeSpent on this day and project

		}

	}
	add column total getTotalForDateSpan(projectId, from, to)

	foreach( days as day ){
		getTotalForDay(projectId, date)
	}

	last row, column
	getTotalForDateSpan(projectId, from, to)
	*/

}

ipcMain.on('updateProject', function(event, id, hash, title, parentId){
	//console.log(id, hash, title, parentId);
	//db.serialize(function() {
		if(id == 0){
			db.run("INSERT INTO project (hash,title,parentId) VALUES (?,?,?)", [hash,title,parentId], function(err){
				if(err){
					console.log((new Error()).stack.split("\n")[1].split(':')[1], "updateProject",  err, "{", id, ",", hash, ",", title, ",", parentId , "}" );
				}
			});
			db.each("SELECT last_insert_rowid() as id", function(err, row) {
				if(err) {
					console.log((new Error()).stack.split("\n")[1].split(':')[1], "updateProject",  err, "{", id, ",", hash, ",", title, ",", parentId , "}" );
				}else{
					event.sender.send('projectAdded', row.id, hash, title, parentId);
					//db.run("UPDATE project SET priority = ? WHERE id = ?", [ row.id, row.id]);
				}
			});

			//db.each("SELECT rowId AS id, hash,title,parentId,priority,deleted FROM project ORDER BY id DESC LIMIT 1", function(err, row) {
				//console.log(row.id,row.hash,row.title,row.parentId,row.priority,row.deleted);
				//});
		}else{
			values = [hash, title, parentId, 0];
			columns = ['hash', 'title', 'parentId', 'priority'];

			for(var i=1; i<arguments.length; i++) {

				if ( arguments[i] == '' ) {
					values.splice(i-1, 1);
					columns.splice(i-1, 1);
				}

			}
			columns = columns.join(' = ?, ')+' = ?';
			values.push(id);
			//console.log("\n", values, columns);
			queryString = "UPDATE project SET "+columns+" WHERE id = ?";

			db.run(queryString, values,
				function(err){
					if(err){
						console.log((new Error()).stack.split("\n")[1].split(':')[1], "updateProject",  err, "{", queryString , "}" );
					}
				}
			);


		}

	//});

});

ipcMain.on('discardProject', function(event, projectId){

	db.run("UPDATE project SET deleted = 1 WHERE id = ?", [projectId],
		function(err){
			if(err){
				console.log((new Error()).stack.split("\n")[1].split(':')[1], "discardProject",  err, "{", projectId , "}" );
			}
		}
	);

});

ipcMain.on('getProjects', function(event, parentId){

	db.all("SELECT rowId AS id, hash,title,parentId FROM project WHERE parentId = ? AND deleted != 1 ORDER BY title", [parentId],
		function(err, row) {
			if(err) {
				console.log((new Error()).stack.split("\n")[1].split(':')[1], "updateProject",  err, "{", parentId , "}" );
			}else{
				event.sender.send('projectsList', parentId, row);
			}
		}
	);

});

ipcMain.on('getProjectsBetween', function(event, ancestorId, descendantId){

	db.all("\
  WITH RECURSIVE \
    related(n) AS ( \
      VALUES(?) \
      UNION \
      SELECT parentId FROM project, related \
       WHERE project.id=related.n \
		AND project.id != ? \
    ) \
SELECT related.n, project.id, project.title, project.parentId FROM related JOIN project on related.n = project.id \
 \
", [descendantId, ancestorId],
		function(err, row) {
			if(err) {
				console.log((new Error()).stack.split("\n")[1].split(':')[1], "getProjectsBetween",  err, "{", ancestorId , ",",descendantId, "}" );
			}else{
				row = row.reverse();
				event.sender.send('projectsListLong', ancestorId, row);
			}
		}
	);

});



ipcMain.on('getChildProjects', function(event, parentId){

	db.all("\
  WITH RECURSIVE \
    related(n) AS ( \
      VALUES(?) \
      UNION \
      SELECT id FROM project, related \
       WHERE project.parentId=related.n \
    ) \
  SELECT id, title FROM project \
   WHERE project.id IN related \
	ORDER BY id DESC ", [parentId], function(err, row) {
		event.sender.send('childProjectsList', parentId, row);
	});

});


ipcMain.on('writeCSVFile', function(event, fileName, data){

	fileDestination = "exports/"+fileName;
	var fs = require('fs');
	var writeStream = fs.createWriteStream(fileDestination);
	for(row in data){
		writeStream.write(data[row].join(",")+"\n");
	}
	writeStream.end();
	event.sender.send('csvFileWritten', fileDestination);

});


ipcMain.on('importFrom', function(event, importParentId, fileName, importType){

	if(importType == 'klok'){
		var importdb = new sqlite3.Database(fileName);

		//console.log(importParentId, fileName);

		//db.run("DELETE FROM project WHERE id > 254");
		//db.run("DELETE FROM timesheet WHERE id > 254");
		importdb.serialize(function() {

			importdb.each("SELECT project_id as id FROM project ORDER BY project_id DESC LIMIT 3", function(err, row) {
				if(err) {
					console.log((new Error()).stack.split("\n")[1].split(':')[1], "importFrom",  err, "{", importParentId, "," ,fileName, "," ,importType , "}" );
				}
				highestId = row.id+importParentId+10;
				//event.sender.send('highestIdEstablished', highestId, importParentId );
			});

			importdb.each("SELECT _lastUpdated as hash, parent_project_id as parentId, name as title, project_id as id, deleted as deleted, displayorder as priority FROM project WHERE archived = 0 ORDER BY project_id ASC, parent_project_id ASC",
				function(err, row) {
		//  WHERE _deleteFlag is null AND archived = 0
					if(err) {

						console.log((new Error()).stack.split("\n")[1].split(':')[1], "importFrom",  err, "{", importParentId, "," ,fileName, "," ,importType , "}" );

					}else{
						//console.log(highestId);
						highestId = parseInt(highestId);
						//console.log(highestId,importParentId);
						newRowId = highestId+row.id;
						if(row.parentId == 0 || row.parentId == ''){
							parentId = importParentId;
						}else{
							parentId = parseInt(highestId)+parseInt(row.parentId);
						}

						db.run("INSERT INTO project (id,hash,title,parentId,deleted) VALUES (?,?,?,?,?)", [newRowId,row.hash,row.title,parentId,row.deleted],
							function(err){
								if(err){
									console.log((new Error()).stack.split("\n")[1].split(':')[1], "importFrom",  err, "{", newRowId,",",row.hash,",",row.title,",",parentId,",",row.deleted , "}" );
								}
							}
						);


					}

				}
			);

			//console.log(highestId,importParentId);
			//db.run("UPDATE project SET id = ? WHERE id = ?", [highestId,importParentId]);


			importdb.each("SELECT timedescriptor_id as id, _lastUpdated as hash, STARTTIMESTAMP, STOPTIMESTAMP, project_id as projectId FROM timeDescriptor WHERE _deleteFlag is null AND deleted = 0",
				function(err, row) {
					if(err){
						console.log((new Error()).stack.split("\n")[1].split(':')[1], "importFrom",  err, "{", importParentId, ",",fileName, ",",importType, "}" );

					}else{
						var startDateTime = moment(row.STARTTIMESTAMP).format('YYYY-MM-DD HH:mm:ss'),
							endDateTime = moment(row.STOPTIMESTAMP).format('YYYY-MM-DD HH:mm:ss'),
							projectId = parseInt(highestId)+parseInt(row.projectId),
							hash = row.hash;
						//console.log(projectId, hash, endDateTime, startDateTime );

						db.run("INSERT INTO timesheet (hash,startDateTime,endDateTime,projectId) VALUES (?,?,?,?)", [hash,startDateTime,endDateTime,projectId],
							function(err){
								if(err){
									console.log((new Error()).stack.split("\n")[1].split(':')[1], "importFrom",  err, "{", hash, ",",startDateTime, ",",endDateTime,",", projectId, "}" );
								}
							}
						);
					}
				}
			);


			event.sender.send('importComplete', importParentId );
		});

	} else {
		event.sender.send('importComplete', importParentId );
	}
//
});



