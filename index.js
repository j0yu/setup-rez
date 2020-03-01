const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');
const process = require('process');
const tc = require('@actions/tool-cache');


async function getInstallPy(extractedPath) {
    // Tarball extracts to repo name + git ref sub-folder
    const extractDir = await fs.promises.opendir(extractedPath);

    for await (const dirent of extractDir) {
        if (dirent.isDirectory()) {
            srcFolder = path.join(extractedPath, dirent.name);
            const srcDir = await fs.promises.opendir(srcFolder);
            
            for await (const srcDirent of srcDir) {
                if (srcDirent.name == 'install.py' && srcDirent.isFile()) {
                    return path.join(srcFolder, srcDirent.name)
                }
            }
        }
    }
    const globPath = path.join(extractedPath, '*', 'install.py');
    throw `Could not find ${globPath}`;
}

async function run() {
    try {
        // Collect parameters and cache, if any
        const rezGitRepo = core.getInput('source');
        const gitRef = core.getInput('ref');    
        var cachedRezPath = tc.find(rezGitRepo, gitRef);

        if (!cachedRezPath.length) {
            const downloadURL = `https://github.com/${rezGitRepo}/archive/${gitRef}.tar.gz`;
            core.info(`Downloading "${downloadURL}"...`);
            
            const rezTarPath = await tc.downloadTool(downloadURL);
            core.debug(`as "${rezTarPath}", extracting into...`);
            
            const rezInstallPath = await tc.extractTar(rezTarPath);
            core.debug(`..."${rezInstallPath}", finding...`);
            
            const rezInstallPy = await getInstallPy(`${rezInstallPath}`);
            core.debug(`..."${rezInstallPy}"`);
            
            core.info("Installing...")
            core.debug(`python ${rezInstallPy} ${rezInstallPath}`);
            await exec.exec('python', [rezInstallPy, rezInstallPath]);
        
            cachedRezPath = await tc.cacheDir(rezInstallPath, rezGitRepo, gitRef);
            core.debug(`...(cached) "${cachedRezPath}"`);
        }
        
        const binFolder = ((process.platform == 'win32') ? 'Scripts': 'bin');
        const rezBinPath = path.join(cachedRezPath, binFolder, 'rez');
        core.addPath(rezBinPath);
        core.debug(`Added "${rezBinPath}" to PATH`);

    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
