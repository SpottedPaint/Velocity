var sqlite3 = require('sqlite3').verbose();
var moment = require('moment');
var db = new sqlite3.Database('velocity.db');
var check;
db.serialize(function() {

  db.run("CREATE TABLE if not exists timesheet (id,hash,startDateTime,endDateTime, projectId)");
 // var stmt = db.prepare("");
  for (var i = 0; i < 10; i++) {
      db.run("INSERT INTO timesheet (hash,startDateTime,endDateTime,projectId) VALUES (?,?,?,?)", ["Ipsum", moment().format('YYYY-MM-DD HH:mm:ss'), moment().format('YYYY-MM-DD HH:mm:ss'), i]);
  }
  //stmt.finalize();

  db.each("SELECT rowId AS id, hash, startDateTime, endDateTime, projectId FROM timesheet", function(err, row) {
      console.log(row.id + "," + row.hash + "," + row.startDateTime + "," + row.endDateTime);
  });
});

db.close();