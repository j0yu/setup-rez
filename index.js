const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const io = require('@actions/io');
const os = require('os');
const path = require('path');
const process = require('process');
const tc = require('@actions/tool-cache');


/**
 * Get full path to a <pre>fs.Dirent</pre> directly under the given folder.
 * @see {@link https://nodejs.org/dist/latest-v12.x/docs/api/fs.html#fs_class_fs_dirent|fs.Dirent}
 * @param {string} dirPath Path to folder to look into.
 * @param {Function} func Callback that returns a boolean on when the
 * right <pre>fs.Dirent</pre> is found.
 * @returns {(string|null)} Path to dirent that satisfies func, else null.
 */
async function getDirentPath(dirPath, func) {
    const extractDir = await fs.promises.opendir(dirPath);
    for await (const dirent of extractDir) {
        if (func(dirent)) {
            return path.join(dirPath, dirent.name);
        }
    }
    return null;
}

/**
 * Get the file path to a file in the extracted repository root folder.
 * @param {string} fileName Filename to get from extracted repository root.
 * @param {string} extractedPath Path to extracted tar/zip repository folder.
 * @throws {MissingFileError} If filename not found directly under the 
 * repository root directory.
 */
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

/**
 * 
 * @typedef envPaths
 * @type object
 * @property {string[]} ENV_VAR_NAMES... Array of paths to add per
 * environment variable.
 */

/**
 *
 * Installs rez.
 *
 * Fetches from GitHub tools cache if previously installed, else extract
 * and install from the given GitHub repository link and Git ref.
 *
 * @param {string} rezGitRepo "user or org"/"repository name"
 * @param {string} gitRef master or commit hash or tag name or branch name.
 * @returns {envPaths} Environment variable names and paths to add for
 * them to setup the installed/cached rez install.
 */
async function installRez(rezGitRepo, gitRef) {
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

    let exeArgs = [];
    let filePath = '';
    let rezInstall = {};
    const binFolder = ((process.platform == 'win32') ? 'Scripts': 'bin');

    const downloadURL = `https://github.com/${rezGitRepo}/archive/${gitRef}.tar.gz`;
    core.info(`Downloading "${downloadURL}"...`);

    const rezTarPath = await tc.downloadTool(downloadURL);
    rezInstallPath = await tc.extractTar(rezTarPath);

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

/**
 * Create rez packages paths.
 *
 * These typically are:
 * <ul font-family=monospace>
 *  <li>$HOME/packages</li>
 *  <li>$HOME/.rez/packages/int</li>
 *  <li>$HOME/.rez/packages/ext</li>
 * </ul>
 */
async function makePackagesPaths() {
    let output = '';

    await exec.exec('rez', ['config', 'packages_path'], {
        listeners: {stdout: (data) => (output += data.toString())},
    })
    for (line of output.trim().split(os.EOL)) {
        await io.mkdirP(line.replace(/^- /, ''));
    }
}

/**
 * Add given environment variable paths to current process.env
 * @param {object} envPaths Environment names mapped to a list of paths to add.
 */
function addPathsToEnvs(envPaths) {
    let paths = [];
    let newPath = '';
    let currentPath = '';

    for (varName in envPaths) {
        if (varName == 'PATH') {
            // Make rez bin available for binding later, if any
            envPaths[varName].forEach(element => {core.addPath(element)});
        } else {
            // Add to current process.env so exec.exec will also pick it up
            currentPath = process.env[varName];
            if (currentPath) {
                paths = currentPath.split(path.delimiter);
                paths.concat(envPaths[varName]);
            } else {
                paths = envPaths[varName];
            }
            newPath = paths.join(path.delimiter);
            core.exportVariable(varName, newPath);
            currentPath = newPath;
        }
    }
}

/**
 * Installs or fetch cached rez install. Setup packages path and binds if any.
 */
async function run() {
    try {
        // Export relevant env vars for a rez install
        addPathsToEnvs(
            await installRez(core.getInput('source'), core.getInput('ref'))
        );

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
            for (pkg of binds.trim().split(",")) {
                await exec.exec('rez', ['bind', pkg.trim()]);
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
