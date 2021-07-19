[![CI](https://github.com/j0yu/setup-rez/workflows/CI/badge.svg?branch=main)](https://github.com/j0yu/setup-rez/actions?query=branch:main+workflow:CI)

# setup-rez

Github Action to setup [rez] package system.


## Usage

```yaml
# Ensure there is a python interpreter first to install rez!
- uses: actions/setup-python@v1
  with:
    python-version: "${{ matrix.python }}"

- uses: j0yu/setup-rez@v1
  # ALL below inputs are optional, these values are the default ones
  with:
    # GitHub repository to install rez from.
    source: 'nerdvegas/rez'

    # Git tag/branch/commit to use.
    ref: 'master'

    # Create all default "rez config packages_path".
    makePackagesPaths: true

    # Comma separated packages to rez bind, e.g. "pip, python, os".
    # To disable, just pass in an empty string "bind: ''"
    # See "rez bind --list".
    # Will force the creation of "rez config local_packages_path"
    binds: "os, python"
```

## Example

For VMs, make sure you run [actions/setup-python] before using
[j0yu/setup-rez] so it has access to a Python Interpreter.

```yaml
name: CI
on: [push]

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-python@v1
        with:
          python-version: 2.7

      # Using custom rez repository and version
      - uses: j0yu/setup-rez@v1
        with:
          source: "mottosso/bleeding-rez"
          ref: "2.33.0"

      # Check if rez is on PATH, check configs and rez bind packages
      - run: rez --version
      - run: rez config local_packages_path
      - run: rez config release_packages_path
      - run: rez config packages_path
      - run: rez view os
      - run: rez view python

      # If our repository has a package.py, let's try test build/installing it
      - uses: actions/checkout@v2
      - run: rez build --install
```

### Containers

If you're using [`container`](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#jobsjob_idcontainer)
you'll need to install Python as per the image/system instead of using [actions/setup-python].


```yaml
name: CI
on: [push]

jobs:
  test-centos7:
    name: Test CentOS 7 (${{ matrix.yum_python }})
    runs-on: ubuntu-latest
    container:
      image: "centos:7"
    strategy:
      matrix:
        yum_python:
          - "python"  # Python 2.7
          - "python3" # Python 3.6

    steps:
      - run: yum install -y ${{ matrix.yum_python }}
      - uses: j0yu/setup-rez@v1
        with:
          pythonExe: ${{ matrix.yum_python }}
      - run: rez --version
      - run: rez python -V
```

In this example, `centos:7` uses an old `glibc` and isn't compatible with
[actions/setup-python]. But `rez` is ok with Python 2.7 and above (as recent as 2.93.0):

- `python`: [j0yu/setup-rez] will use a slightly updated Python 2.7 interpreter that's
  already shipped with `centos:7`.
- `python3`: [j0yu/setup-rez] will run rez's `install.py` using `python3`
  (nice coincidence) as the interpreter, instead of the default `python`.


## How it works

Everything is done in the `run` function in `index.js`:

1. Get cached install for the `source` and `ref` input combination
1. If there is no installs/tools cache install rez:
    1. Downloads and extracts from `https://github.com/${source}/archive/${ref}.tar.gz`
    1. If `install.py` exists, install via `python install.py DEST`

         else, if `setup.py` exists, install via `pip install --target DEST SRC`
    1. Store required environment variable paths to append in a `setup.json`
1. Load and append environment variables paths from `setup.json`

   Typically `PATH` for `rez` command, `PYTHONPATH` if used `pip install --target`.

1. Create any `rez config package_paths` folders if required.
1. Create any `rez bind PKG...` packages if required.

Notes on install style availability:

Rez                   | (1st) install.py | (2nd) pip install
----------------------|------------------|------------------
nerdvegas/rez         | Always           | 2.33.0+
mottosso/bleeding-rez | NEVER            | Always


## Developing

Clone this repository down and modify:

- `index.js` for the inner workings and logic.

    - [Node.js 12x] API docs
    - [GitHub Action Toolkit Sub-Packages]

- `action.yml` for input/output and action definition.

    - [GitHub: Building actions] specifically [Metadata Syntax]

- `.github/workflows/ci.yml` for tests.



<details><summary>at the humble beginnings...</summary>

I didn't want to have npm installed, so here's the Docker contained way I
worked on CentOS-7. See [Creating a JavaScript action].

1. Clone this repository.
1. `cd` into the repository.
1. Edit the `action.yml`
1. Setup `npm` package using Docker container.

    ```bash
    alias npm="docker run --rm -it -v "$(pwd):$(pwd)" --user "$(id -u):$(id -g)" -w "$(pwd)" node:12 npm"
    npm init -y
    npm install @actions/core --save
    npm install @actions/exec --save
    npm install @actions/io --save
    npm install @actions/tool-cache --save
    ```
1. Edit the `index.js`
1. Add paths required, then push:

    ```bash
    git add --force action.yml index.js node_modules/* package.json package-lock.json README.md
    git commit
    git push
    ```

</details>


[j0yu/setup-rez]: github.com/j0yu/setup-rez
[actions/setup-python]: github.com/actions/setup-python
[GitHub Action Toolkit Sub-Packages]: https://github.com/actions/toolkit#packages
[Metadata Syntax]: https://help.github.com/en/actions/building-actions/metadata-syntax-for-github-actions
[Node.js 12x]: https://nodejs.org/dist/latest-v12.x/docs/api/
[GitHub: Building actions]: https://help.github.com/en/actions/building-actions
[rez]: https://github.com/nerdvegas/rez
[actions/setup-python]: https://github.com/actions/setup-python
[Creating a JavaScript action]: https://help.github.com/en/actions/building-actions/creating-a-javascript-action
