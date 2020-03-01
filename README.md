# setup-rez

Github Action to setup rez package system

<!-- 
## Inputs

### `who-to-greet`

**Required** The name of the person to greet. Default `"World"`.

## Outputs

### `time`

The time we greeted you. -->

## Example usage

```yaml
uses: j0yu/setup-rez@v1
with:
  source: "nerdvegas/rez"
  ref: "master"
  path: ".rez"
```

## Developing

### Starting from fresh

I didn't want to have npm installed, so here's the Docker contained way I
worked on CentOS-7.

1. Clone this repository.
1. `cd` into the repository.
1. Edit the `actions.yml`
1. Setup `npm` package using Docker container.

    ```bash
    alias npm="docker run --rm -it -v "$(pwd):$(pwd)" --user "$(id -u):$(id -g)" -w "$(pwd)" node:12 npm"
    npm init -y
    npm install @actions/core
    npm install @actions/github
    ```