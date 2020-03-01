const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');
const process = require('process');
const tc = require('@actions/tool-cache');


async function getInstallPy(extractedPath) {
    // Tarball extracts to repo name + git ref sub-folder
    core.info("typeof extractedPath");
    core.info(typeof extractedPath);
    const extractDir = await fs.promises.opendir(extractedPath);

    for await (const dirent of extractDir) {
        if (dirent.isDirectory()) {
            core.info("typeof dirent.name");
            core.info(typeof dirent.name);
            srcFolder = path.join(extractedPath, dirent.name);

            core.info("typeof srcFolder");
            core.info(typeof srcFolder);
            const srcDir = await fs.promises.opendir(srcFolder);
            
            for await (const srcDirent of srcDir) {
                if (srcDirent.name == 'install.py') {
                    return path.join(srcDir, srcDirent.name)
                }
            }
        }
    }
    return '';
}

async function run() {
    try {
        // Collect parameters and cache, if any
        const rezGitRepo = core.getInput('source');
        const gitRef = core.getInput('ref');    
        var cachedRezPath = tc.find(rezGitRepo, gitRef);

        if (!cachedRezPath.length) {
            const downloadURL = `https://github.com/${rezGitRepo}/archive/${gitRef}.tar.gz`;
            core.info(`Downloading "${downloadURL}" into...`)
            const rezTarPath = await tc.downloadTool(downloadURL);
            core.info(`..."${rezTarPath}", extracting into...`)
            const rezInstallPath = await tc.extractTar(rezTarPath);
            core.info(`..."${rezInstallPath}", finding...`)
            const rezInstallPy = await getInstallPy(`${rezInstallPath}`)
            core.info(`..."${rezInstallPy}", installing...`)

            await exec.exec('python', [rezInstallPy, rezInstallPath]);
        
            cachedRezPath = await tc.cacheDir(rezInstallPath, rezGitRepo, gitRef);
            core.info(`...(cached) "${cachedRezPath}"`)
        }
        
        const binFolder = ((process.platform == 'win32') ? 'Scripts': 'bin');
        const rezBinPath = path.join(cachedRezPath, binFolder, 'rez');
        core.addPath(rezBinPath);
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
