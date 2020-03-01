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