# ITF Trace Viewer

VS Code extension for viewing [ITF trace
files](https://apalache.informal.systems/docs/adr/015adr-trace.html) as nicely
formatted tables.

## Features

- There are two view modes: 
    1. "Single table" mode displays each state of the trace as a row in a table.
    2. "Chained tables" mode displays a sequence of states, where each state is a table.
- Differences in fields of consecutive states are displayed with border colors:
    - Red for same-type objects with different values.
    - Violet for same-type objects that differ in their set of keys.
    - Green for new elements that don't exist in the previous state.
- Filter by variables: select which variables you want to hide or show.
- Hide or show the initial state (hidden by default).

## Manual installation

1. Press `cmd/crtl+shift+P` for the command pallete.
2. Type "Extensions: Install from VSIX...".
3. Select the file [build/itf-trace-viewer-0.0.3.vsix](build/itf-trace-viewer-0.0.3.vsix) provided in this repo.
