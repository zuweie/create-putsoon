#!/usr/bin/env node

'use strict';
const shell = require('shelljs');
const cliProgress = require('cli-progress');
const https = require('https');
const fs = require('fs');
const colors = require('colors/safe');
const os = require('os');
const {DownloaderHelper} = require('node-downloader-helper');
const argv = require('yargs').argv
const inquirer = require('inquirer');


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

let downloader3 = function (url, dist_dir, file_name) {
    let download_result = shell.exec(`wget ${url} -O ${dist_dir}/${file_name}`);
    if (download_result.code == 0){
        return dist_dir+'/'+file_name;
    }
    throw download_result.stderr;
}

~ async function () {

    let mode = argv.mode? argv.mode : 'manual'; // auto,manual,test,
    let answer = null;
    let test = shell.exec('wget -V > /dev/null');
    if (test.code != 0) {
        console.log(colors.red(' wget is required for download putsoon, install wget first.'));
    }
    //console.log(test_wget.code);
    //return 0;
    try {

        let cwd = process.cwd();
        let session = shell.cat(`${cwd}/._session`);
        let step = session.code == 0 ? session.stdout : '0';

        if (step == '0') {

            if (mode == 'auto' || mode == 'test') {
                console.log(colors.green('- configure:'));
                let question = [
                    {
                        type:'input',
                        name:'login',
                        message:'enter your login account (defalut admin) of putsoon:'
                    },
                    {
                        type:'input',
                        name:'password',
                        message:'enter your login password (default 123456) of putsoon:'
                    },
                    {
                        type:'list',
                        name:'env',
                        message:'choose your enviroment: ',
                        choices: [
                            {name:'production', value:'pro'},
                            {name:'development', value:'dev'}
                        ]
                    },
                ];
        
                answer = await inquirer.prompt(question);
                answer.login = answer.login?answer.login:'admin';
                answer.password = answer.password?answer.password:'123456';
            }
            
            let putsoon_zip = 'putsoon.zip';
            let zip_file = '';
            /**
             * step 1 download the putsoon.zip
             */
            // auto mode
            // download the putsoon zip file.
            console.log(colors.green('- start downloading putsoon.zip'));
            if (mode == 'auto' || mode == 'manual') {
                zip_file = downloader3('https://github.com/zuweie/putsoon/archive/master.zip', cwd, putsoon_zip);
            } else {
                zip_file = downloader3('https://github.com/zuweie/putsoon-node_modules/raw/master/test-putsoon.zip', cwd, putsoon_zip);
            }
            console.log(colors.yellow('putsoon download completed'));
    
            console.log(colors.green('- unpacking source file ...'));
            let result = shell.exec(`unzip -q ${zip_file}`);
            if (result.code == 127) {
                throw result.stderr;
            }
            shell.mv(cwd + '/putsoon-master/*', cwd);
            shell.rm('-fr', `${zip_file}`);
            shell.rm('-fr', `${cwd}/putsoon-master`);
            if (mode == 'auto'){
                shell.exec(`echo 1 > ${cwd}/._session`);
            }
        }


        if (mode == 'auto') {

            // auto mode
            console.log(colors.green('- install node modules ...'));
            let result =  shell.exec('npm install --production');
            console.debug('install result', result);
            if (result.code != 0) {
                throw result.stderr;
            }
            console.log(colors.green('- setup putsoon ...'));
            shell.exec(`npm run setup -- --login=${answer.login} --password=${answer.password}`);
            shell.exec(`npm run seeding:${answer.env}`);
            console.log(colors.yellow('putsoon install successful.'));
            console.log(colors.yellow('command: "npm run start -- --port=xxxx(default 7001)" start putsoon with port xxxx in production env')); 
            console.log(colors.yellow('command: "npm run dev -- --port=xxxx(default 7001)" start putsoon with port xxxx in development env.'));
            console.log(colors.yellow('command: "npm run stop" stop the putoon'));
            console.log(colors.yellow('lanunch putsoon http://127.0.0.1:7001/admin on Browser'));
            return;
        }else if (mode == 'test') {
            // test mode
            console.log(colors.yellow('test mode will install notthing'));
            console.log(`npm run setup -- --login=${answer.login} --password=${answer.password}`);
            console.log(`npm run seeding:${answer.env}`);
            shell.exec('ls -all '+cwd+'/');
            shell.rm('-rf', cwd+'/*');
            return;
        }else {
            // manual mode
            console.log(colors.yellow('commend: "1.0 npm install --production" for install the putsoon node_modules'));
            console.log(colors.yellow('command: "2.0 npm run setup" for setup the putsoon'));
            console.log(colors.yellow('comment: "3.0 npm run seeding:pro" for init data of putsoon production enviroment'))
            console.log(colors.yellow('comment: "3.1 npm run seeding:dev" for init data of putsoon development enviroment'));
            console.log(colors.yellow('command: "4.0 npm run start -- --port=xxxx(default 7001)" start putsoon with port xxxx(default 7001) in production env')); 
            console.log(colors.yellow('command: "4.1 npm run dev -- --port=xxxx(default 7001)" start putsoon with port xxxx(default 7001) in development env.'));
            console.log(colors.yellow('command: "5.0 npm run stop" stop the putoon'));
            console.log(colors.yellow('lanunch putsoon http://127.0.0.1:xxxx(default 7001)/admin on Browser'));
        }

    } catch (e) {
        console.error(colors.red(e));
        return;
    }
    shell.rm('-rf', `${process.cwd()}/._session`);
} ();