const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const io = require('@actions/io');
const os = require('os');
const path = require('path');
const process = require('process');
const tc = require('@actions/tool-cache');


async function getRepoRootFile(fileName, extractedPath) {
    // Tarball extracts to repo name + git ref sub-folder
    const extractDir = await fs.promises.opendir(extractedPath);

    for await (const dirent of extractDir) {
        if (dirent.isDirectory()) {
            srcFolder = path.join(extractedPath, dirent.name);
            const srcDir = await fs.promises.opendir(srcFolder);

            for await (const srcDirent of srcDir) {
                if (srcDirent.name == fileName && srcDirent.isFile()) {
                    return path.join(srcFolder, srcDirent.name);
                }
            }
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
    var cachedBinPath = tc.find(rezGitRepo, gitRef);
    if (cachedBinPath.length) {
        return cachedBinPath;
    }

    const downloadURL = `https://github.com/${rezGitRepo}/archive/${gitRef}.tar.gz`;
    core.info(`Downloading "${downloadURL}"...`);

    const rezTarPath = await tc.downloadTool(downloadURL);
    core.debug(`as "${rezTarPath}", extracting into...`);

    const rezInstallPath = await tc.extractTar(rezTarPath);
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
    let rezBinPath = '';

    try {
        filePath = await getRepoRootFile('install.py', rezInstallPath);
        exeArgs = ['python', filePath, rezInstallPath];
        rezBinPath = path.join(rezInstallPath, binFolder, 'rez');
    } catch (error) {
        if (error.name != 'MissingFileError') {
            throw error
        }
        exeArgs = ['pip', 'install', '--target', rezInstallPath];
        filePath = await getRepoRootFile('setup.py', rezInstallPath);
        exeArgs.push(path.dirname(filePath));
        rezBinPath = path.join(rezInstallPath, binFolder);
    }
    // const installCommand = exeArgs.join(" ")
    const installExe = exeArgs.shift()

    core.info("Installing...")
    // core.debug(`${installCommand}`);
    await exec.exec(installExe, exeArgs);

    cachedBinPath = await tc.cacheDir(rezBinPath, rezGitRepo, gitRef);
    core.debug(`...(cached) "${cachedBinPath}"`);
    return cachedBinPath;
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
        const rezBinPath = await installRez();
        core.addPath(rezBinPath);
        core.debug(`Added "${rezBinPath}" to PATH`);

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
