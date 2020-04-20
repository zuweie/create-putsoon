#!/usr/bin/env node

'use strict';
const shell = require('shelljs');
const cliProgress = require('cli-progress');
const https = require('https');
const fs = require('fs');
const colors = require('colors/safe');
const AdmZip = require('adm-zip');
const os = require('os');
const {DownloaderHelper} = require('node-downloader-helper');
const argv = require('yargs').argv
const inquirer = require('inquirer');

/*
let downloader = function (url, target, output, default_length) {

    return new Promise((resolve, reject) => {
        //let master_url = "https://codeload.github.com/zuweie/putsoon/zip/master";
        https.get(url, res=>{

            if (res.statusCode >= 400) {
                let body = res.body;
                res.resume();
                reject(body);
            }
            
            let download_bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
            let total_size = res.headers['content-length']?parseInt(res.headers['content-length']):default_length;
            let download_size = 0;
            console.log(colors.green(`- start download ${target}...`));
            download_bar.start(total_size, download_size);

            let ws = fs.createWriteStream(output);
            res.pipe(ws);

            res.on('data', chunk => {
                download_size += chunk.length;
                download_bar.update(download_size);
            });

            res.on('end', ()=>{
                download_bar.update(total_size);
                download_bar.stop();
                ws.end();
            });

            ws.on('finish', ()=>{

                //console.log('ws finish');
                // 在这里 resolve 才能确保所有数据下载完。
                resolve(output);
            });
        }).on('error', e => {
            reject(e.message);
        });;
    });
}
*/

let downloader2 = function (url, dist_dir, filename, default_length) {
    return new Promise((resolve, reject) => {

        let dl = new DownloaderHelper(url, dist_dir, {fileName: filename, override:true});
        let progress_bar = null;
        let total = default_length;
        dl.on('start', ()=> {
            progress_bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        });

        dl.on('download', dlinfo => {
            total = isNaN(dlinfo.totalSize)?default_length : dlinfo.totalSize;
            progress_bar.start(total, dlinfo.downloadedSize);
        });

        dl.on('progress', dlinfo => {
            progress_bar.update(dlinfo.downloaded);
        });

        dl.on('end', dlinfo => {
            progress_bar.update(total);
            progress_bar.stop();
            progress_bar = null;
            resolve(dist_dir+'/'+filename);
        });

        dl.on('error', info => {
            progress_bar.stop();
            progress_bar = null;
            reject(info.message);

        });
        dl.start();
    });
}

~ async function () {


    let platform = os.platform();
    let arch     = os.arch();

    let dl = argv.dl? argv.dl : 'all';
    let mode = argv.mode? argv.mode : 'setup';

    //console.debug('dl', dl);

    if (arch != 'x64') {
        console.error(colors.red(`SORRY! putsoon dose not support <${arch}> yet.`));
        return;
    }

    if (platform != 'darwin' && platform != 'linux') {
        console.error(colors.red(`SORRY! putsoon dose not support platform <${platform}>.`));
        return;
    }
    
    try {
        let cwd = process.cwd();
        let zip = null;
        let zip_file = '';
        /**
         * step 1 download the putsoon.zip
         */
        
        if (dl == 'putsoon' || dl == 'all') {
            console.log(colors.green('- start download putsoon.zip'));
            if (mode == 'setup') {
                zip_file = await downloader2('https://github.com/zuweie/putsoon/archive/master.zip', cwd, 'putsoon.zip', 1024000)
            }else{
                zip_file = await downloader2('https://github.com/zuweie/putsoon-node_modules/raw/master/test-putsoon.zip', cwd, 'putsoon.zip', 1024);
            }
            console.log(colors.green('unpacking source file ...'));
            zip = new AdmZip(zip_file);
            zip.extractAllTo(cwd);
            shell.mv(cwd + '/putsoon-master/*', cwd);
            shell.rm('-fr', cwd + '/putsoon.zip');
            shell.rm('-fr', cwd + '/putsoon-master');
            console.log(colors.green('putsoon download completed'));
        }

        
        
        /**
         * step 2 download node_modules.zip
         */
        if (dl == 'modules' || dl == 'all') {
            let module_dir = cwd + '/node_modules/';
            shell.mkdir(cwd + '/node_modules');

            if (platform == 'darwin') {
                console.log(colors.green(`- start downloading <${platform}> modules ...`));
                //zip_file = await downloader("https://raw.githubusercontent.com/zuweie/putsoon-node_modules/master/putsoon-node_modules-darwin-1.0.0.zip", "modules.zip", output, 72*1024*1024);
                if (mode == 'setup') {
                    zip_file = await downloader2('https://github.com/zuweie/putsoon-node_modules/raw/master/putsoon-node_modules-darwin-1.0.0.zip', cwd, 'node_modules.zip', 72*1024*1024);
                }else {
                    zip_file = await downloader2('https://github.com/zuweie/putsoon-node_modules/raw/master/test_modules.zip', cwd, 'node_modules.zip', 5*1024);
                }
                //zip_file = await downloader2('https://github.com/zuweie/putsoon-node_modules/raw/master/ylru.zip', module_dir, 'node_modules.zip', 5 * 1024);
            }
            console.log(colors.green('unpacking the node modules.'));
            zip = new AdmZip(zip_file);
            zip.extractAllTo(module_dir);
            shell.rm('-fr', zip_file);
            console.log(colors.green('node_modules download completed.'));
        }

        if (mode == 'test') return;
        
        console.log(colors.green('- choose your env:'));

        let question = [
            {
                type:'input',
                name:'login',
                message:'enter your login account (defalut admin):'
            },
            {
                type:'input',
                name:'password',
                message:'enter your login password (default 123456):'
            },
            {
                type:'list',
                name:'env',
                message:'choose your env: ',
                choices: [
                    {name:'production', value:'pro'},
                    {name:'development', value:'dev'}
                ]
            },
        ];
        let {env, login, password} = await inquirer.prompt(question);
        login = login?login:'admin';
        password = password?password:'123456';
        //console.debug('answer', answer);
        //return;

        console.log(colors.green('- setup putsoon ...'));
        shell.exec(`npm run setup -- --login=${login} --password=${password}`);

        shell.exec(`npm run seeding:${env}`);
        console.log(colors.green('putsoon install successful.'));
        console.log(colors.yellow('command: "npm run start -- --port=xxxx(default 7001)" start putsoon with port xxxx in production env')); 
        console.log(colors.yellow('command: "npm run dev -- --port=xxxx(default 7001)" start putsoon with port xxxx in development env.'));
        console.log(colors.yellow('command: "npm run stop" stop the putoon'));
        console.log(colors.yellow('lanunch putsoon http://127.0.0.1:7001/admin on Browser'));
        return;
    } catch (e) {
        console.error(colors.red(e));
        return;
    }
} ();