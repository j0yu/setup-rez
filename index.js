const core = require('@actions/core');
const exec = require('@actions/exec');
const path = require('path');
const process = require('process');
const tc = require('@actions/tool-cache');

try {
    // Collect parameters
    const rezGitRepo = core.getInput('source');
    const gitRef = core.getInput('ref');
    // const installPath = core.getInput('path')

    //   set -x -o pipefail
    //   # Setup latest rez and paths (master branch)
    //   git clone "https://github.com/nerdvegas/rez.git" .rez
    //   python .rez/install.py _rez
    //   export PATH="$(pwd)/_rez/${{ matrix.bin-folder }}/rez:${PATH}"
    //   rez bind platform
    //   mkdir -vp "$(rez config local_packages_path)"
    // https://github.com/nerdvegas/rez/archive/b44b898c3d25db89e3256ae0210cb370ca5e503f.zip
    // https://github.com/nerdvegas/rez/archive/b44b898c3d.tar.gz

    
    var cachedRezPath = tc.find(rezGitRepo, gitRef)
    if (!cachedRezPath.length) {
        const rezTarPath = await tc.downloadTool(`https://github.com/${rezGitRepo}/archive/${gitRef}.tar.gz`)
        const rezSrcPath = await tc.extractTar(rezTarPath, 'src')
        const rezInstallPath = path.dirname(rezSrcPath)
        await exec.exec('python', [path.join(rezSrcPath, 'install.py'), rezInstallPath])
    
        cachedRezPath = await tc.cacheDir(rezInstallPath, rezGitRepo, gitRef)
    }
    
    const binFolder = ((process.platform == 'win32') ? 'Scripts': 'bin')
    const rezBinPath = path.join(cachedRezPath, binFolder, 'rez')
    core.addPath(rezBinPath)

    // await exec.exec('git', ['clone', '--quiet', '' 
    // console.log(`Hello ${rezGitRepo}!`);
    // const time = (new Date()).toTimeString();
    // core.setOutput("time", time);
    // // Get the JSON webhook payload for the event that triggered the workflow
    // const payload = JSON.stringify(github.context.payload, undefined, 2)
    // console.log(`The event payload: ${payload}`);
} catch (error) {
    core.setFailed(error.message);
}