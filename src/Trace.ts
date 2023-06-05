/* eslint-disable curly */
/* eslint-disable @typescript-eslint/naming-convention */

import { arraysEqual, getElement, getValue, getProperty } from "./util";
// import deepEqual from 'deep-equal';

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

type MapContent<S, T> = Array<[S, T]>;

function getMapContentKeys<S, T>(m?: MapContent<S, T>): S[] {
    return m !== undefined ? m.map(([k, _]) => k) : [];
}

interface MapObject<S, T> {
    "#map": MapContent<S, T>;
}

function isMapObject(a: any): boolean {
    return Object.keys(a).length === 1 && Object.keys(a).includes("#map");
}

function getMapContent<S, T>(m?: MapObject<S, T>): MapContent<S, T> | undefined {
    return m !== undefined && "#map" in m ? m["#map"] : undefined;
}

function getMapKeys<S, T>(m?: MapObject<S, T>): S[] {
    return getMapContentKeys(getMapContent(m));
}

// Generic list representing a set or a tuple
interface ListObject<T> {
    [key: string]: Array<T>;
}

interface SetObject<T> extends ListObject<T> {
    "#set": Array<T>;
}

function isSetObject(a: any): boolean {
    return Object.keys(a).length === 1 && Object.keys(a).includes("#set");
}

function getSetContent<T>(m?: SetObject<T>): Array<T> | undefined {
    return m !== undefined && "#set" in m ? m["#set"] : undefined;
}

interface TupleObject<T> extends ListObject<T> {
    "#tup": Array<T>;
}

function isTupleObject(a: any): boolean {
    return Object.keys(a).length === 1 && Object.keys(a).includes("#tup");
}

function getTupleContent<T>(m?: TupleObject<T>): Array<T> | undefined {
    return m !== undefined && "#tup" in m ? m["#tup"] : undefined;
}

export enum ViewMode {
    SingleTable = "table",
    ChainedTables = "chain",
}

function deepEqual(x: any, y: any): boolean {
    return JSON.stringify(x) === JSON.stringify(y);
}

// The elements in a that are not in b
function elementsNotInArray<S>(a: S[], b: S[]): S[] {
    return a.filter(x => !b.some(y => deepEqual(x, y)));
}

function firstElementNotInArray<S>(a: S[], b: S[]): S | undefined {
    return a.find(x => !b.some(y => deepEqual(x, y)));
}

// Return true iff a has at least one element that is not in b.
function hasElementsNotInArray<S>(a?: S[], b?: S[]): boolean {
    if (a === undefined) {
        return false;
    }
    if (b === undefined) {
        return true;
    }
    return firstElementNotInArray(a, b) !== undefined;
}

// Return true if a has at least one element that is not in b.
function hasElementsNotIn(a: any, b: any): boolean {
    if (a === undefined)
        return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        return hasElementsNotInArray(a, b);
    } else if (typeof a === "object" && typeof b === "object") {
        if (isMapObject(a) && isMapObject(b)) {
            return hasElementsNotInArray(getMapKeys(a), getMapKeys(b));
        } else if (isSetObject(a) && isSetObject(b)) {
            return hasElementsNotInArray(getSetContent(a), getSetContent(b));
        } else if (isTupleObject(a) && isTupleObject(b)) {
            return hasElementsNotInArray(getTupleContent(a), getTupleContent(b));
        } else {
            return hasElementsNotInArray(Object.keys(a), Object.keys(b));
        }
    }
    return false;
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

    const tables = states
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
    const numRow = `<tr><td class="varName">#</td><td>${index}</td></tr>`;
    const rows = Object.entries(st)
        .filter(s => s[0] !== '#meta' && vars.includes(s[0]))
        .sort()
        .map(([varName, value]) => {
            const prevValue = getProperty(prevState, varName);
            let html = tlaToHtml(value, prevValue);
            const cellClass = hasElementsNotIn(prevValue, value) ? "hasLessElements" : "";
            return `<tr>
                <td class="varName">${varName}</td>
                <td class="${cellClass}">${html}</td>
                </tr>`;
        })
        .join("\n");
    return `<table id="main-table">${numRow}${rows}</table>`;
}

// Each state is a row in a single table
function statesToSingleTableHtml(vars: string[], states: State[], showInitialState: boolean) {
    vars = ["#", ...vars.sort()];
    const headerCells = vars.map(v => `<th class="varName">${v}</th>`).join("\n");
    const header = `<tr>${headerCells}</tr>`;

    var prevState = states[0];

    if (!showInitialState) {
        states = states.slice(1);
    }

    const rows = states
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
    const numCell = `<td class="first-column">${index}</td>`;
    const cells = Object.entries(state)
        .filter(entry => entry[0] !== '#meta' && vars.includes(entry[0]))
        .sort()
        .map(([key, value]) => {
            let prevValue = getProperty(prevState, key);
            let html = tlaToHtml(value, prevValue);
            let cellClass = hasElementsNotIn(prevValue, value) ? "hasLessElements" : "";
            return `<td class="${cellClass}">${html}</td>`;
        }).join("\n");
    return `<tr>${numCell}${cells}</tr>`;
}

function tlaToHtml(value: any, prevValue?: any): string {
    if (Array.isArray(value)) {
        return arrayToHtml((x) => `[ ${x} ]`, value, prevValue);
    } else if (typeof value === "object") {
        if (isMapObject(value)) {
            return mapContentToHtml(getMapContent(value), getMapContent(prevValue));
        } else if (isSetObject(value)) {
            return arrayToHtml((x) => `{&nbsp;${x}&nbsp;}`, getSetContent(value), getSetContent(prevValue));
        } else if (isTupleObject(value)) {
            return arrayToHtml((x) => `&#9001;&nbsp;${x}&nbsp;&#9002;`, getTupleContent(value), getTupleContent(prevValue));
        } else {
            return objectToHtml(value, prevValue);
        }
    }
    return basicToHtml(value, prevValue);
}

function basicToHtml(value: object, prevValue?: object): string {
    let html = JSON.stringify(value);
    if (prevValue !== undefined && !deepEqual(value, prevValue)) {
        html = `<div class="prevIsDifferent">${html}</div>`;
    }
    return html;
}


// Return a tuple with:
// - the html representation of the object `obj`, and 
// - whether we want to display in the parent object that this one is different
//   than the one in the previous state. This is only needed if we cannot show
//   inside the html of `obj` that there is a difference; for example, when we
//   remove an element.
function objectToHtml(obj?: object, prev?: object): string {
    if (obj === undefined) {
        return "";
    }
    const sameKeys = prev !== undefined && arraysEqual(Object.keys(obj), Object.keys(prev));
    const rows = Object.entries(obj)
        .map(([key, value]) => {
            let prevValue = sameKeys ? getProperty(prev, key) : value;

            let rowClass = "";
            let valueClass = "";
            if (sameKeys) {
                if (prevValue === undefined) {
                    rowClass = "newElement";
                    prevValue = value; // don't look for differences in the rest
                } else if (!deepEqual(value, prevValue)) {
                    valueClass = "prevIsDifferent";
                    prevValue = value; // don't look for differences in the rest
                }
            }

            let html = tlaToHtml(value, prevValue);
            if (sameKeys && hasElementsNotIn(prevValue, value)) {
                html = `<div class="hasLessElements">${html}</div>`;
            }

            return `<tr class="${rowClass}"><td>${key}</td><td>:</td><td class="${valueClass}">${html}</td></tr>`;
        });

    const objectClass = sameKeys ? "" : "prevIsDifferent";
    return `<table class="object ${objectClass}">${rows.join("\n")}</table>`;
}

function mapContentToHtml<S, T>(map_?: MapContent<S, T>, prev?: MapContent<S, T>): string {
    if (map_ === undefined) {
        return "";
    }
    const keys = getMapContentKeys(map_);
    const prevKeys = getMapContentKeys(prev);
    let rows = map_
        .map(([key, value], _) => {
            const htmlKey = tlaToHtml(key, key);
            let prevValue = getValue(prev, key);

            let rowClass = "";
            let valueClass = "";
            if (!prevKeys.some(k => deepEqual(k, key))) {
                rowClass = "newElement";
                prevValue = value; // don't look for differences in the rest
            } else if (!deepEqual(value, prevValue)) {
                valueClass = "prevIsDifferent";
                prevValue = value;
            }

            let htmlValue = tlaToHtml(value, prevValue);
            if (hasElementsNotIn(prevValue, value)) {
                htmlValue = `<div class="hasLessElements">${htmlValue}</div>`;
            }

            return `<tr class="${rowClass}"><td>${htmlKey}</td><td>&#8614;</td><td class="${valueClass}">${htmlValue}</td></tr>`;
        });

    // empty map
    if (rows.length === 0) {
        rows = [`&nbsp;&#x2205;&nbsp;`];
    }

    let html = `<table class="map">${rows.join("\n")}</table>`;
    if (hasElementsNotIn(prevKeys, keys)) {
        html = `<div class="prevIsDifferent">${html}</div>`;
    }
    return `<div class="map">${html}</div>`;
}

function arrayToHtml<T>(
    wrapper: (_: string) => string,
    arr?: Array<T>,
    prevArr?: Array<T>,
): string {
    if (arr === undefined) {
        return "";
    }
    const newElements = prevArr === undefined ? arr : elementsNotInArray(arr, prevArr);
    let elems = arr
        .map((value, _) => {
            let elemClasses = "arrayElem";
            if (newElements.some(x => x === value)) {
                elemClasses += " newElement";
            }

            let html = tlaToHtml(value, undefined);
            return `<span class="${elemClasses}">${html}</span>`;
        });

    let html = `<div class="array">${wrapper(elems.join(",&nbsp;"))}</div>`;
    if (hasElementsNotIn(prevArr, arr)) {
        html = `<div class="prevIsDifferent">${html}</div>`;
    }
    return html;
}
