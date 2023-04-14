/* eslint-disable curly */
/* eslint-disable @typescript-eslint/naming-convention */

import { arraysEqual, getElement, getValue, getProperty } from "./util";

export interface Trace {
    "#meta": SchemaMeta;
    states: State[];
    vars: string[];
}

interface SchemaMeta {
    description: string;
    format: string;
    "format-description": string;
}

interface State {
    "#meta": StateMeta;
}

interface StateMeta {
    index: number;
}

interface MapObject<S, T> {
    "#map": Array<[S, T]>;
}

// Generic list representing a set or a tuple
interface ListObject<T> {
    [key: string]: Array<T>;
}

interface SetObject<T> extends ListObject<T> {
    "#set": Array<T>;
}

interface TupleObject<T> extends ListObject<T> {
    "#tup": Array<T>;
}

export enum ViewMode {
    SingleTable,
    ChainedTables,
}

export function toHtml(
    trace: Trace,
    selectedVariables: string[],
    showInitialState: boolean,
    viewMode: ViewMode = ViewMode.SingleTable
) {
    if (viewMode === ViewMode.SingleTable) {
        return statesToSingleTableHtml(selectedVariables, trace.states, showInitialState);
    } else {
        return statesToChainedTablesHtml(selectedVariables, trace.states, showInitialState);
    }
}

// A state is a table, and each state is placed below another state, except the
// first one.
function statesToChainedTablesHtml(vars: string[], states: State[], showInitialState: boolean) {
    var prevState = states[0];

    if (!showInitialState) {
        states = states.slice(1);
    }

    let tables = states
        .map((st, i) => {
            let num = showInitialState ? i : i + 1;
            let html = stateToHtml(st, prevState, num, vars);
            prevState = st;
            return html;
        })
        .join("\n");

    return `<p>${tables}</p>`;
}

function stateToHtml(st: State, prevState: State, index: number, vars: Array<string>): string {
    let numRow = `<tr><td class="varName">#</td><td>${index}</td></tr>`;
    let rows = Object.entries(st)
        .filter(s => s[0] !== '#meta' && vars.includes(s[0]))
        .sort()
        .map(([varName, value]) => {

            var cssClass = "";
            let prevValue = getProperty(prevState, varName);
            let [html, equal] = tlaToHtml(value, prevValue);
            if (typeof prevValue !== 'object' && !equal) {
                cssClass = "prevIsDifferent";
            }

            return `<tr>
                <td class="varName">${varName}</td>
                <td class="${cssClass}">${html}</td>
                </tr>`;
        })
        .join("\n");
    return `<table id="main-table">${numRow}${rows}</table>`;
}

// Each state is a row in a single table
function statesToSingleTableHtml(vars: string[], states: State[], showInitialState: boolean) {
    vars = ["#", ...vars.sort()];
    let headerCells = vars.map(v => `<th class="varName">${v}</th>`).join("\n");
    let header = `<tr>${headerCells}</tr>`;

    var prevState = states[0];

    if (!showInitialState) {
        states = states.slice(1);
    }

    let rows = states
        .map((st, i) => {
            let num = showInitialState ? i : i + 1;
            let html = stateToRowHtml(st, prevState, num, vars);
            prevState = st;
            return html;
        })
        .join("\n");

    return `<p><table id="main-table" class="multiple-states">
        <thead>${header}</thead>
        <tbody>${rows}</tbody>
        </table></p>`;
}

function stateToRowHtml(state: State, prevState: State, index: number, vars: Array<string>): string {
    let numCell = `<td>${index}</td>`;
    let cells = Object.entries(state)
        .filter(entry => entry[0] !== '#meta' && vars.includes(entry[0]))
        .sort()
        .map(([key, value]) => {
            var cssClass = "";
            let prevValue = getProperty(prevState, key);

            let [html, equal] = tlaToHtml(value, prevValue);
            if (typeof prevValue !== 'object' && !equal) {
                cssClass = "prevIsDifferent";
            }

            return `<td class="${cssClass}">${html}</td>`;
        }).join("\n");
    return `<tr>${numCell}${cells}</tr>`;
}

function tlaToHtml(value: any, prevValue: any): [string, boolean] {
    if (typeof value === "object") {
        if (Object.keys(value).length === 1 && Object.keys(value).includes("#map")) {
            return mapToHtml(value as MapObject<any, any>, prevValue as MapObject<any, any>);
        } else if (Object.keys(value).length === 1 && Object.keys(value).includes("#set")) {
            return listToHtml(value as SetObject<any>, prevValue as SetObject<any>, "#set", (x) => `{${x}}`);
        } else if (Object.keys(value).length === 1 && Object.keys(value).includes("#tup")) {
            return listToHtml(value as TupleObject<any>, prevValue as TupleObject<any>, "#tup", (x) => `&#9001;${x}&#9002;`);
        } else {
            return objectToHtml(value, prevValue);
        }
    }
    return tlaBasicToHtml(value, prevValue);
}

function tlaBasicToHtml(value: any, prevValue: any): [string, boolean] {
    return [JSON.stringify(value), value === prevValue];
}

function objectToHtml(obj: object, prevObj?: object): [string, boolean] {
    var isEqualToPrev = true;
    var tableClass = "";

    if (prevObj !== undefined && !arraysEqual(Object.keys(obj), Object.keys(prevObj))) {
        tableClass = "differentKeys";
        prevObj = obj; // keys are different; no need to look for differences in the rest
    }

    let rows = Object.entries(obj)
        .map(([k, v]) => {
            let prevValue = getProperty(prevObj, k);

            var keyClass = "";
            var valueClass = "";
            if (prevValue === undefined) {
                keyClass = "newElement";
                valueClass = "newElement";
                isEqualToPrev = false;
                prevValue = v; // don't look for differences in the rest
            } else if (typeof prevValue !== 'object' && v !== prevValue) {
                valueClass = "prevIsDifferent";
                isEqualToPrev = false;
            }
            let [html, eq] = tlaToHtml(v, prevValue);
            isEqualToPrev = isEqualToPrev && eq;

            return `<tr>
                <td class=${keyClass}>${k}</td>
                <td class="${keyClass}">:</td>
                <td class="${valueClass}">${html}</td>
                </tr>`;
        });
    return [`<table class="${tableClass}">${rows.join("\n")}</table>`, isEqualToPrev];
}

function mapToHtml<S, T>(m: MapObject<S, T>, prev: MapObject<S, T>): [string, boolean] {
    var prevMap: Array<[S, T]> | undefined = undefined;
    if (prev !== undefined && "#map" in prev) {
        prevMap = prev["#map"];
    }

    if (m["#map"].length === 0) {
        let equal = prevMap !== undefined && prevMap.length === 0;
        return [`<span>[]</span>`, equal];
    }

    var isEqualToPrev = true;
    let rows = m["#map"]
        .map(([k, v], i) => {
            let [htmlKey, _] = tlaToHtml(k, k);

            var keyClass = "";
            var valueClass = "";
            let prevValue = getValue(prevMap, k);
            if (prevValue === undefined) {
                keyClass = "newElement";
                valueClass = "newElement";
                isEqualToPrev = false;
                prevValue = v; // don't look for differences in the rest
            } else if (typeof prevValue !== 'object' && v !== prevValue) {
                valueClass = "prevIsDifferent";
                isEqualToPrev = false;
            }
            let [html, eq] = tlaToHtml(v, prevValue);
            isEqualToPrev = isEqualToPrev && eq;

            return `<tr>
                <td class="${keyClass}">${htmlKey}</td>
                <td>&#8614;</td>
                <td class="${valueClass}">${html}</td>
                </tr>`;
        });

    return [`[<table>${rows.join("\n")}</table>]`, isEqualToPrev];
}

function listToHtml<T>(
    list: ListObject<T>,
    prev: ListObject<T>,
    tagName: "#set" | "#tup",
    wrapper: (_: string) => string,
): [string, boolean] {
    var prevList: Array<T> | undefined = undefined;
    if (prev !== undefined && tagName in prev) {
        prevList = prev[tagName].sort();
    }

    var isEqualToPrev = true;
    let elems = list[tagName].sort()
        .map((v, i) => {
            var elemClass = "";
            if (!prevList?.includes(v)) {
                elemClass = "newElement";
                isEqualToPrev = false;
            }

            let prevValue = getElement(prevList, i);
            if (typeof prevValue !== 'object' && v !== prevValue) {
                elemClass = "prevIsDifferent";
                isEqualToPrev = false;
            }
            let [html, eq] = tlaToHtml(v, prevValue);
            isEqualToPrev = isEqualToPrev && eq;

            return `<span class="${elemClass}">${html}</span>`;
        });
    return [`<span>${wrapper(elems.join(", "))}</span>`, isEqualToPrev];
}
