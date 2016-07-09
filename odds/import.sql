CREATE TABLE project (_deleteFlag TEXT, _localChangeFlag TEXT, _lastUpdated NUMBER, CODE TEXT,DESCRIPTION TEXT,PARENT_PROJECT_ID TEXT,ARCHIVED TEXT,ESTIMATE REAL,HOURLYRATE REAL,CONTACTPHONE TEXT,PROJECTTYPE TEXT,NAME TEXT,EXPENSEREPORTREF REAL,COLOR REAL,CONTACTEMAIL TEXT,PROJECT_ID INTEGER PRIMARY KEY AUTOINCREMENT,DISPLAYORDER INTEGER,DELETED TEXT,LOCALONLY TEXT,CONTACTNAME TEXT,TAGS TEXT,BILLABLE TEXT,REMOTEID TEXT);

CREATE TABLE timeDescriptor (_deleteFlag TEXT, _localChangeFlag TEXT, _lastUpdated NUMBER, PROJECT_ID TEXT,STOPTIMESTAMP NUMBER,COMMENT TEXT,STARTTIMESTAMP NUMBER,TIMEDESCRIPTOR_ID INTEGER PRIMARY KEY AUTOINCREMENT,DELETED TEXT,REMOTEID TEXT,TAGS TEXT, INVOICED text, INVOICEDAMOUNT number, LOCALONLY text);



CREATE TABLE _klokMetaData (name TEXT PRIMARY KEY, value TEXT);

CREATE TABLE _remoteDeleteQueue (id INTEGER PRIMARY KEY AUTOINCREMENT, connector TEXT, itemType TEXT, itemSubType TEXT, remoteId TEXT);

CREATE TABLE projectTag (_deleteFlag TEXT, _localChangeFlag TEXT, _lastUpdated NUMBER, REMOTEID TEXT,PROJECT_TAG_ID INTEGER PRIMARY KEY AUTOINCREMENT,TAG TEXT,PROJECT_ID TEXT);


SELECT * FROM project WHERE _deleteFlag is null LIMIT 1;

SELECT _lastUpdated as hash, parent_project_id as parentId, name as title, project_id as id, deleted as deleted, displayorder as priority
fROM project
WHERE _deleteFlag is null
AND archived = 0
LIMIT 10;

SELECT count(*)
FROM project
WHERE _deleteFlag is null
AND archived = 0;
-- 134

SELECT timedescriptor_id as id, starttimestamp, stoptimestamp, project_id as projectId FROM timeDescriptor WHERE _deleteFlag is null AND deleted = 0 LIMIT 1;

SELECT count(*) FROM timeDescriptor WHERE _deleteFlag is null ;
-- 156 ?
SELECT count(*), project_id FROM timeDescriptor WHERE _deleteFlag is not null AND deleted = 0 GROUP BY project_Id;