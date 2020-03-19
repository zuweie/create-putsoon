#!/usr/bin/env node
'use strict';
const shell = require('shelljs');

~ async function () {
    let cwd = process.cwd();
    shell.exec('wget https://github.com/zuweie/putsoon/archive/master.zip');
    shell.exec('unzip master.zip');
    shell.mv(cwd+'/putsoon-master/*', cwd);
    shell.rm('-fr', cwd+'/master.zip');
    shell.rm('-fr', cwd+'/putsoon-master');
} ();