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
            const rezTarPath = await tc.downloadTool(`https://github.com/${rezGitRepo}/archive/${gitRef}.tar.gz`);
            const rezInstallPath = await tc.extractTar(rezTarPath);
            const rezInstallPy = await getInstallPy(rezInstallPath)

            await exec.exec('python', [rezInstallPy, rezInstallPath]);
        
            cachedRezPath = await tc.cacheDir(rezInstallPath, rezGitRepo, gitRef);
        }
        
        const binFolder = ((process.platform == 'win32') ? 'Scripts': 'bin');
        const rezBinPath = path.join(cachedRezPath, binFolder, 'rez');
        core.addPath(rezBinPath);
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
