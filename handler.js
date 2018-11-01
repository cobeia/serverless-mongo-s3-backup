"use strict";

const AWS = require("aws-sdk");
const fs = require("fs");
const url = require("url");

const exec = require("child_process").exec;

const s3Path = process.env.S3_PATH;
const host = process.env.HOST;
const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const dbName = process.env.DB;

const tar = require("tar");
const s3bucket = new AWS.S3({
  params: {
    Bucket: s3Path
  }
});

module.exports.dump = function(event, context, cb) {
  process.env["PATH"] =
    process.env["PATH"] + ":" + process.env["LAMBDA_TASK_ROOT"];
  console.log(process.env["PATH"]);
  let fileName =
    "dump_cobeia_prod_" +
    new Date().toDateString().replace(/ /g, "") +
    "_" +
    new Date().getTime();
  let folderName = "/tmp/" + fileName + "/";
  exec(
    "mongodump --host " +
      host +
      " --ssl --db " +
      dbName +
      " --username " +
      username +
      " --password " +
      password +
      " --authenticationDatabase admin " +
      " -o " +
      folderName,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      let filePath = "/tmp/" + fileName + ".tgz";

      tar
        .c(
          {
            gzip: true,
            file: filePath
          },
          [folderName]
        )
        .then(_ => {
          fs.readFile(filePath, function(err, data) {
            s3bucket.createBucket(function() {
              let params = {
                Key: fileName + ".tgz",
                Body: data
              };
              s3bucket.upload(params, function(err, data) {
                // Whether there is an error or not, delete the temp file
                fs.unlink(filePath, function(err) {
                  if (err) {
                    console.error(err);
                  }
                  console.log("Temp File Delete");
                });

                if (err) {
                  console.log("ERROR MSG: ", err);
                } else {
                  console.log("Successfully uploaded data");
                }
              });
            });
          });
        });
    }
  );
};
