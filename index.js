const core = require('@actions/core');
const exec = require('@actions/exec');
const path = require('path');
const process = require('process');
const tc = require('@actions/tool-cache');

async function run() {
    try {
        // Collect parameters and cache, if any
        const rezGitRepo = core.getInput('source');
        const gitRef = core.getInput('ref');    
        var cachedRezPath = tc.find(rezGitRepo, gitRef);

        if (!cachedRezPath.length) {
            const rezTarPath = await tc.downloadTool(`https://github.com/${rezGitRepo}/archive/${gitRef}.tar.gz`);
            const rezSrcPath = await tc.extractTar(rezTarPath, 'src');
            const rezInstallPath = path.dirname(rezSrcPath);
            await exec.exec('python', [path.join(rezSrcPath, 'install.py'), rezInstallPath]);
        
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
