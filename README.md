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

Includes a lot of [rez] example commands and outputs.

```yaml
name: CI
on: [push]

jobs:
  test:
    name: Testing on ${{ matrix.os }} Py${{ matrix.python }}
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os:
        - ubuntu-latest
        - macOS-latest
        - windows-latest
        python:
        - 2.7
        - 3.7

    steps:
      - uses: actions/setup-python@v1
        with:
          python-version: "${{ matrix.python }}"

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

[GitHub Action Toolkit Sub-Packages]: https://github.com/actions/toolkit#packages
[Metadata Syntax]: https://help.github.com/en/actions/building-actions/metadata-syntax-for-github-actions
[Node.js 12x]: https://nodejs.org/dist/latest-v12.x/docs/api/
[GitHub: Building actions]: https://help.github.com/en/actions/building-actions
[rez]: https://github.com/nerdvegas/rez
[actions/setup-python]: https://github.com/actions/setup-python
[Creating a JavaScript action]: https://help.github.com/en/actions/building-actions/creating-a-javascript-action