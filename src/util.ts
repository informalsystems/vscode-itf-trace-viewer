export function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export function getProperty(obj: any, key: any) {
    if (obj !== undefined && hasOwnProperty(obj, key)) {
        return obj[key];
    } else {
        return undefined;
    }
}

export function getElement<T>(array: Array<T> | undefined, ix: number): T | undefined {
    if (array !== undefined && 0 <= ix && ix < array.length) {
        return array[ix];
    } else {
        return undefined;
    }
}

export function getValue<S, T>(array: Array<[S, T]> | undefined, key: S): T | undefined {
    if (array === undefined) {
        return undefined;
    }
    var value = undefined;
    array.forEach(([k, v]) => {
        if (typeof k === 'object' && typeof key === 'object') {
            if (shallowEqual(k as object, key as object)) {
                value = v;
                return;
            }
        } else if (k === key) {
            value = v;
            return;
        }
    });
    return value;
}

export function arraysEqual<T>(a: Array<T>, b: Array<T>) {
    return a.length === b.length && a.every((val, index) => val === b[index]);
}

// From: https://fettblog.eu/typescript-hasownproperty/
function hasOwnProperty<T extends {}, P extends PropertyKey>
    (obj: T, prop: P): obj is T & Record<P, unknown> {
    return obj.hasOwnProperty(prop);
}

function shallowEqual(obj1: object, obj2: object): boolean {
    return Object.keys(obj1).length === Object.keys(obj2).length &&
        (Object.keys(obj1) as (keyof typeof obj1)[]).every((key) => {
            return hasOwnProperty(obj2, key) && obj1[key] === obj2[key];
        });
}
