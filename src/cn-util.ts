import { TextDocument } from 'vscode';
let Segment = require('segment');
export let segment = new Segment();

export enum Direction {
    left,
    right
}

export function isHanChar(charCode : number) : boolean {
    if (0x3400 <= charCode && charCode <= 0x4dbf  // CJK Unified Ideographs Extension A
        || 0x4e00 <= charCode && charCode <= 0x9fff  // CJK Unified Ideographs
        || 0x20000 <= charCode && charCode <= 0x2a6df  // CJK Unified Ideographs Extension B
        || 0x2a700 <= charCode && charCode <= 0x2ebef  // CJK Unified Ideographs Extension C,D,E,F
        ) {
        return true;
    } else {
        return false;
    }
}

export function findHanWordBorder(
    doc: TextDocument,
    line: number,
    col: number,
    direction: Direction,
): number {
    let lineText: string = doc.lineAt(line).text;
    let colStart: number = col, colEnd: number = col;

    while (isHanChar(lineText.charCodeAt(colStart - 1))
    ) {
        colStart --;
    }
    while (isHanChar(lineText.charCodeAt(colEnd))
    ) {
        colEnd ++;
    }

    let slice = lineText.slice(colStart, colEnd);
    let segments: string[] = segment.doSegment(slice, {simple: true});
    
    let i: number = -1;
    while (direction === Direction.left && colStart < col
        || direction === Direction.right && colStart <= col) {
        i += 1;
        colStart += segments[i].length;
    } 
    colEnd = colStart;
    colStart -= segments[i].length;

    return direction === Direction.left ? colStart : colEnd;
}