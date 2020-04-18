#!/usr/bin/env node

'use strict';
const shell = require('shelljs');
const cliProgress = require('cli-progress');
const https = require('https');
const fs = require('fs');
const colors = require('colors/safe');
const AdmZip = require('adm-zip');
~ async function () {

    // step 1 download the master.zip
    let cwd = process.cwd();
    let download_size = 0;

    let download = new Promise((resolve, reject) => {
        let master_url = "https://codeload.github.com/zuweie/putsoon/zip/master";
        https.get(master_url, res=>{

            if (res.statusCode >= 400) {
                let body = res.body;
                res.resume();
                reject(body);
            }
            
            let download_bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
            let total_size = res.headers['content-length']?parseInt(res.headers['content-length']):1024000;
            
            console.log(colors.green('start downloading...'));
            download_bar.start(total_size, download_size);

            let zip = cwd + '/putsoon.zip';
            //let fd = fs.open(zip,'w');
            let ws = fs.createWriteStream(zip);
            res.pipe(ws);

            res.on('data', chunk => {
                download_size += chunk.length;
                download_bar.update(download_size);
            });

            res.on('end', ()=>{
                download_bar.update(total_size);
                download_bar.stop();
                // ws.end() 方法触发 finish 事件。
                ws.end();
                //resolve(zip)
            });

            ws.on('finish', ()=>{

                //console.debug('ws finish');
                // 在这里 resolve 才能确保所有数据写完了，才返回。
                resolve(zip);
            });
        }).on('error', e => {
            reject(e.message);
        });;
    });

    try {
        let zip_file = await download;
         // step 2 unzip the master.zip 
        //let stat = fs.statSync(zip_file);
        //console.debug('donwload file size', stat.size);
        //console.debug('download szie', download_size);

        console.debug(colors.green('unpacking...'));
         /*
         shell.exec('unzip '+zip);
         
         */
        
        let zip = new AdmZip(zip_file);
        zip.extractAllTo(cwd);
        shell.mv(cwd + '/putsoon-master/*', cwd);
        shell.rm('-fr', cwd + '/putsoon.zip');
        shell.rm('-fr', cwd + '/putsoon-master');
        console.debug(colors.green('download completed ~'));
        return;
    } catch (e) {
        console.error(e);
        return;
    }
} ();