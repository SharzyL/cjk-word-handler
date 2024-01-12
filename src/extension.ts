'use strict';
import * as vscode from 'vscode';
import { Position, TextDocument, TextEditor } from 'vscode';

import { _select, _delete, _move } from './controls';
import { IConfig, parseConfig } from './config';
import { CharClass, isHanChar, makeClassifier } from './classifyChar';
import { seg, segInit } from './seg';

let config: IConfig

export function activate(context: vscode.ExtensionContext) {
    function registerCommand(name: string, cmd: Function) {
        let disposable = vscode.commands.registerCommand(
            name,
            () => {
                let editor = vscode.window.activeTextEditor!;
                let wordSeparators = vscode.workspace
                    .getConfiguration("editor", editor.document.uri)
                    .get("wordSeparators");
                cmd(editor, wordSeparators);
            });
        context.subscriptions.push(disposable);
    }

    // Register commands
    registerCommand('cjkWordHandler.cursorWordEndRight', cursorWordEndRight);
    registerCommand('cjkWordHandler.cursorWordEndRightSelect', cursorWordEndRightSelect);
    registerCommand('cjkWordHandler.cursorWordStartLeft', cursorWordStartLeft);
    registerCommand('cjkWordHandler.cursorWordStartLeftSelect', cursorWordStartLeftSelect);
    registerCommand('cjkWordHandler.deleteWordEndRight', deleteWordEndRight);
    registerCommand('cjkWordHandler.deleteWordStartLeft', deleteWordStartLeft);

    config = parseConfig();
    vscode.workspace.onDidChangeConfiguration(parseConfig);
    segInit();
}

// export function for testing
export function cursorWordEndRight(editor: TextEditor, wordSeparators: string) {
    _move(editor, wordSeparators, findNextWordEnd);
}

export function cursorWordEndRightSelect(editor: TextEditor, wordSeparators: string) {
    _select(editor, wordSeparators, findNextWordEnd);
}

export function cursorWordStartLeft(editor: TextEditor, wordSeparators: string) {
    _move(editor, wordSeparators, findPreviousWordStart);
}

export function cursorWordStartLeftSelect(editor: TextEditor, wordSeparators: string) {
    _select(editor, wordSeparators, findPreviousWordStart);
}

export function deleteWordEndRight(editor: TextEditor, wordSeparators: string) {
    return _delete(editor, wordSeparators, findNextWordEnd);
}

export function deleteWordStartLeft(editor: TextEditor, wordSeparators: string) {
    return _delete(editor, wordSeparators, findPreviousWordStart);
}

//-----------------------------------------------------------------------------
/**
 * Gets position of the end of a word after specified position.
 */
function findNextWordEnd(
    doc: TextDocument,
    caretPos: Position,
    wordSeparators: string
): Position {
    // If the cursor is at an end-of-document, return original position.
    // If the cursor is at an end-of-line, return position of the next line.
    // If the cursor is at WSP character(s), skip the WSP(s) starting with it.
    // If no characters exist after the WSPs, return the position.
    // If there is a non-WSP character after the WSPs, return end position of
    // a non-WSP character sequence which starts with it.

    const classify = makeClassifier(wordSeparators);
    let pos = caretPos;
    let line = pos.line, col = pos.character;

    // when at end of line, jump to the next line
    if ( col === doc.lineAt(line).text.length ) {
        const nextLine = line + 1;
        return (nextLine < doc.lineCount)
            ? new Position(nextLine, 0) // end-of-line
            : caretPos;                 // end-of-document
    }

    // skip a series of whitespaces
    while ( classify(doc, line, col) === CharClass.Whitespace ) {
        col ++;
    }

    let klass = classify(doc, line, col);

    // if the next character is Han character, execute word segmenting
    if (klass === CharClass.Han) {
        return new Position(line, findHanWordBorder(doc, line, col, Direction.right));
    }

    // otherwise go forward until class of character changes
    while ( classify(doc, line, col) === klass ) {
        col ++;
    }
    return new Position(line, col);
}

/**
 * Gets position of the word before specified position.
 */
function findPreviousWordStart(
    doc: TextDocument,
    caretPos: Position,
    wordSeparators: string
) {
    // Brief spec of this function:
    // - Firstly, skips a sequence of WSPs, if there is.
    //   - If reached start of a line, quit there.
    // - Secondly, seek backward until:
    //   1. character type changes, or
    //   2. reaches start of a line.

    const classify = makeClassifier(wordSeparators);
    let pos = caretPos;
    let line = pos.line, col = pos.character;

    if (col === 0) { // when at start of line, go to the end of last line
        if (line === 0) {
            return pos;
        } else {
            line --;
            col = doc.lineAt(line).text.length;
            return new Position(line, col);
        }
    }

    // Firstly skip whitespaces, excluding EOL codes.
    while (classify(doc, line, col - 1) === CharClass.Whitespace) {
        col --;
    }

    let klass = classify(doc, line, col - 1);

    // if the next character is Han character, execute word segmenting
    if (klass === CharClass.Han) {
        return new Position(line, findHanWordBorder(doc, line, col, Direction.left));
    }

    // otherwise go forward until class of character changes
    while ( classify(doc, line, col - 1) === klass ) {
        col --;
    }
    return new Position(line, col);
}

export enum Direction {
    left,
    right
}

export function findHanWordBorder(
    doc: TextDocument,
    line: number,
    col: number,
    direction: Direction,
): number {
    let lineText: string = doc.lineAt(line).text;
    let colStart: number = col, colEnd: number = col;

    while (isHanChar(lineText.charCodeAt(colStart - 1))) {
        colStart --;
    }
    while (isHanChar(lineText.charCodeAt(colEnd))) {
        colEnd ++;
    }

    let slice = lineText.slice(colStart, colEnd);
    let segments: string[] = seg(slice, config.chinesePartitioningRule);
    
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