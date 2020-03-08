const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const io = require('@actions/io');
const os = require('os');
const path = require('path');
const process = require('process');
const tc = require('@actions/tool-cache');


async function getDirentPath(dirPath, func) {
    const extractDir = await fs.promises.opendir(dirPath);
    for await (const dirent of extractDir) {
        if (func(dirent)) {
            return path.join(dirPath, dirent.name);
        }
    }
    return null;
}

async function getRepoRootFile(fileName, extractedPath) {
    // Tarball extracts to repo name + git ref sub-folder
    const srcFolder = await getDirentPath(
        extractedPath,
        (dirent) => {return dirent.isDirectory()},
    );
    if (srcFolder) {
        const filePath = await getDirentPath(
            srcFolder,
            (dirent) => {return dirent.isFile() && dirent.name == fileName},
        );
        if (filePath) {
            return filePath;
        }
    }

    const globPath = path.join(extractedPath, '*', fileName)
    throw {
        'name': 'MissingFileError',
        'message': `Could not find ${globPath}`,
    };
}


async function installRez() {
    // Collect parameters and cache, if any
    const rezGitRepo = core.getInput('source');
    const gitRef = core.getInput('ref');

    var rezInstallPath = tc.find(rezGitRepo, gitRef);
    if (rezInstallPath.length) {
        var manifestData = null;
        const manifestPath = path.join(rezInstallPath, 'setup.json')
        try {
            manifestData = fs.readFileSync(manifestPath);
        } catch (error) {
            if (error.code != 'ENOENT') throw error
        }
        if (manifestData) {
            return JSON.parse(manifestData);
        };
    }

    const downloadURL = `https://github.com/${rezGitRepo}/archive/${gitRef}.tar.gz`;
    core.info(`Downloading "${downloadURL}"...`);

    const rezTarPath = await tc.downloadTool(downloadURL);
    core.debug(`as "${rezTarPath}", extracting into...`);

    rezInstallPath = await tc.extractTar(rezTarPath);
    core.debug(`..."${rezInstallPath}", finding...`);

    /* NOTES on install style availability:
     *
     *                       | pip install | install.py
     * nerdvegas/rez         | 2.33.0+     | Always
     * mottosso/bleeding-rez | Always      | NEVER
     *
     * In order or priority...
     *
     * 1. install.py:
     *     - Check if install.py exists
     *     - python SRC/install.py DEST
     *     - export PATH=DEST/bin/rez
     *
     * 2. pip:
     *     - Check if setup.py exists
     *     - pip install --target DEST SRC
     *     - export PATH=DEST/bin
     *
     * 3. throw error
     */
    let exeArgs = [];
    let filePath = ''
    const binFolder = ((process.platform == 'win32') ? 'Scripts': 'bin');
    let rezInstall = {};

    try {
        filePath = await getRepoRootFile('install.py', rezInstallPath);
        exeArgs = ['python', filePath, rezInstallPath];
        rezInstall['PATH'] = [path.join(rezInstallPath, binFolder, 'rez')];
    } catch (error) {
        if (error.name != 'MissingFileError') {
            throw error
        }
        exeArgs = ['pip', 'install', '--target', rezInstallPath];
        filePath = await getRepoRootFile('setup.py', rezInstallPath);
        exeArgs.push(path.dirname(filePath));
        rezInstall['PATH'] = [path.join(rezInstallPath, binFolder)];
        rezInstall['PYTHONPATH'] = [rezInstallPath];
    }
    // const installCommand = exeArgs.join(" ")
    const installExe = exeArgs.shift()

    core.info("Installing...")
    // core.debug(`${installCommand}`);
    await exec.exec(installExe, exeArgs);

    fs.writeFileSync(
        path.join(rezInstallPath, 'setup.json'), 
        JSON.stringify(rezInstall),
    )
    await tc.cacheDir(rezInstallPath, rezGitRepo, gitRef);
    core.debug(`...(cached) "${rezInstallPath}" with setup.json`);

    return rezInstall;
}


async function makePackagesPaths() {
    let output = '';
    let line = ''

    await exec.exec('rez', ['config', 'packages_path'], {
        listeners: {stdout: (data) => (output += data.toString())},
    })
    for (line of output.trim().split(os.EOL)) {
        await io.mkdirP(line.replace(/^- /, ''));
    }
}


async function run() {
    try {
        // Export relevant env vars for a rez install
        const rezInstall = await installRez();
        let paths = [];
        for (varName in rezInstall) {
            if (varName == 'PATH') {
                rezInstall[varName].forEach(element => {core.addPath(element)});
            } else {
                if (process.env[varName]) {
                    paths = process.env[varName].split(path.delimiter)
                    paths.concat(rezInstall[varName])
                } else {
                    paths = rezInstall[varName]
                }
                core.exportVariable(varName, paths.join(path.delimiter))
                process.env[varName] = paths.join(path.delimiter)
            }
        }

        // Create all packages_path folders
        if (core.getInput('makePackagesPaths')) {
            makePackagesPaths();
        }

        const binds = core.getInput('binds');
        if (binds.length) {
            // Create local packages path
            let output = '';
            await exec.exec('rez', ['config', 'local_packages_path'], {
                listeners: {stdout: (data) => (output += data.toString())},
            })
            await io.mkdirP(output.trimRight());

            // Create bind per package name (comma separated, remove whitespace)
            let pkg = '';
            for (pkg of binds.trim().split(",")) {
                await exec.exec('rez', ['bind', pkg.trim()]);
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
