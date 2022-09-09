// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
    const vscode = acquireVsCodeApi();

    document.querySelector('#switch-view-button').addEventListener('click', () => {
        vscode.postMessage({
            command: 'switch-view'
        });
    });

    for (var checkbox of document.querySelectorAll('input[name=vars]')) {
        checkbox.addEventListener('click', () => {
            var checkedVariables = [];
            var checkedBoxes = document.querySelectorAll('input[type=checkbox]:checked');

            for (var i = 0; i < checkedBoxes.length; i++) {
                checkedVariables.push(checkedBoxes[i].value);
            }

            vscode.postMessage({
                command: 'filter-variables',
                variables: checkedVariables
            });
        });
    }

    document.querySelector('input[name=init]').addEventListener('click', () => {
        vscode.postMessage({
            command: 'show-initial-state'
        });
    });

    // Handle messages sent from the extension to the webview
    // window.addEventListener('message', event => {
    //     const message = event.data; // The json data that the extension sent
    //     switch (message.command) {
    //         case 'refactor':
    //             currentCount = Math.ceil(currentCount * 0.5);
    //             counter.textContent = `${currentCount}`;
    //             break;
    //     }
    // });
}());
