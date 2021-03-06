'use strict';
import * as vscode from 'vscode';
import { Position, Range, Selection, TextDocument, TextEditor } from 'vscode';

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

    parseConfig();
    vscode.workspace.onDidChangeConfiguration(parseConfig);
    segment.useDefault();
    
}

function _move(
    editor: TextEditor,
    wordSeparators: string,
    find: Function
) {
    const document = editor.document;
    editor.selections = editor.selections
        .map(s => find(document, s.active, wordSeparators))
        .map(p => new Selection(p, p));
    if (editor.selections.length === 1) {
        editor.revealRange(editor.selection);
    }
}

function _select(
    editor: TextEditor,
    wordSeparators: string,
    find: Function
) {
    editor.selections = editor.selections
        .map(s => new Selection(
            s.anchor,
            find(editor.document, s.active, wordSeparators))
        );
    if (editor.selections.length === 1) {
        editor.revealRange(editor.selection);
    }
}

async function _delete(
    editor: TextEditor,
    wordSeparators: string,
    find: Function
) {
    return editor.edit(e => {
        const document = editor.document;
        let selections = editor.selections.map(
            s => new Selection(
                s.anchor,
                find(document, s.active, wordSeparators)
            ));
        for (let selection of selections) {
            e.delete(selection);
        }
    }).then(() => {
        if (editor.selections.length === 1) {
            editor.revealRange(editor.selection);
        }
    });
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
enum CharClass {
    Alnum,  // alphabet & numbers & underscore
    Whitespace,
    Punctuation,
    Hiragana,
    Katakana,
    Han,  // Chinese Han characters
    Hangul, // Korean characters
    Other,
    Separator,
    Invalid = NaN
}

enum ChinesePartitioningRule {
    ByCharacters,
    ByWords,
    BySentences
}
interface IConfig {
    chinesePartitioningRule: ChinesePartitioningRule;
}
let config: IConfig = {
    chinesePartitioningRule: ChinesePartitioningRule.ByWords
};
function parseConfig() {
    const cfg = vscode.workspace.getConfiguration('cjkWordHandler');
    const rule = cfg.get('chinesePartitioningRule');
    switch (rule) {
        case "By characters": 
            config.chinesePartitioningRule = ChinesePartitioningRule.ByCharacters;
            break;
        case "By words": 
            config.chinesePartitioningRule = ChinesePartitioningRule.ByWords;
            break;
        case "By sentences":
            config.chinesePartitioningRule = ChinesePartitioningRule.BySentences;
            break;
        default:
            vscode.window.showErrorMessage(
                `"${rule}" is not an valid value for chinesePartitioningRule`
            );
    }
}

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

    // Skip a series of whitespaces

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

/**
 * Compose a character classifier function.
 * @param wordSeparators A string containing characters to separate words
 *                       (mostly used in English-like language context.)
 */
function makeClassifier(wordSeparators: string) {
    return function classifyChar(
        doc: TextDocument,
        line: number,
        character: number
    ) {
        if (line < 0 || character < 0) {
            return CharClass.Invalid;
        }

        const range = new Range(
            line, character,
            line, character + 1
        );
        const text = doc.getText(range);
        if (text.length === 0) {
            return CharClass.Invalid;  // end-of-line or end-of-document
        }
        const ch = text.charCodeAt(0);

        if (wordSeparators.indexOf(text) !== -1) {
            return CharClass.Separator;
        }

        if ((0x09 <= ch && ch <= 0x0d) || ch === 0x20 || ch === 0x3000) {
            return CharClass.Whitespace;
        }

        if ((0x30 <= ch && ch <= 0x39)          // halfwidth digit
            || (0xff10 <= ch && ch <= 0xff19)   // fullwidth digit
            || (0x41 <= ch && ch <= 0x5a)       // halfwidth alphabet, upper case
            || ch === 0x5f                      // underscore
            || (0x61 <= ch && ch <= 0x7a)       // halfwidth alphabet, lower case
            || (0xc0 <= ch && ch <= 0xff        // latin character
                && ch !== 0xd7 && ch !== 0xf7)  // (excluding multiplication/division sign)
            || (0xff21 <= ch && ch <= 0xff3a)   // fullwidth alphabet, upper case
            || ch === 0xff3f                    // fullwidth underscore
            || (0xff41 <= ch && ch <= 0xff5a)) {// fullwidth alphabet, lower case
            return CharClass.Alnum;
        }

        if ((0x21 <= ch && ch <= 0x2f)
            || (0x3a <= ch && ch <= 0x40)
            || (0x5b <= ch && ch <= 0x60)
            || (0x7b <= ch && ch <= 0x7f)
            || (0x3001 <= ch && ch <= 0x303f && ch !== 0x3005)               
                // CJK punctuation marks except Ideographic iteration mark
            || ch === 0x30fb                    // Katakana middle dot
            || (0xff01 <= ch && ch <= 0xff0f)   // "Full width" forms (1)
            || (0xff1a <= ch && ch <= 0xff20)   // "Full width" forms (2)
            || (0xff3b <= ch && ch <= 0xff40)   // "Full width" forms (3)
            || (0xff5b <= ch && ch <= 0xff65)   // "Full width" forms (4)
            || (0xffe0 <= ch && ch <= 0xffee)) {// "Full width" forms (5)
            return CharClass.Punctuation;
        }

        if (isHanChar(ch)) {
            return CharClass.Han;
        }

        if (0xac00 <= ch && 0xd7a3
            || 0x1100 <= ch && ch <= 0x11ff
            || 0x3131 <= ch && ch <= 0x318e
            || 0xffa1 <= ch && ch <= 0xffdc) {
                return CharClass.Hangul;
            }

        if ((0x30a0 <= ch && ch <= 0x30ff)      // fullwidth katakana
            && ch !== 0x30fb) {                 // excluding katakana middle dot
            return CharClass.Katakana;
        }

        if (0x3041 <= ch && ch <= 0x309f) {     // fullwidth hiragana
            return CharClass.Hiragana;
        }

        if (0xff66 <= ch && ch <= 0xff9d) {     // halfwidth katakana
            return CharClass.Katakana;
        }

        return CharClass.Other;
    };
}

const Segment = require('segment');

export const segment = new Segment();

function seg(str: string): string[] {
    switch (config.chinesePartitioningRule) {
        case ChinesePartitioningRule.ByCharacters:
            return str.split('');
        case ChinesePartitioningRule.BySentences:
            return [str];
        case ChinesePartitioningRule.ByWords:
            return segment.doSegment(str, {simple: true});
    }
}

function isHanChar(charCode : number) : boolean {
    if (0x3400 <= charCode && charCode <= 0x4dbf  
        // CJK Unified Ideographs Extension A
        || 0x4e00 <= charCode && charCode <= 0x9fff  
        // CJK Unified Ideographs
        || 0x20000 <= charCode && charCode <= 0x2a6df  
        // CJK Unified Ideographs Extension B
        || 0x2a700 <= charCode && charCode <= 0x2ebef  
        // CJK Unified Ideographs Extension C,D,E,F
        ) {
        return true;
    } else {
        return false;
    }
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

    while (isHanChar(lineText.charCodeAt(colStart - 1))
    ) {
        colStart --;
    }
    while (isHanChar(lineText.charCodeAt(colEnd))
    ) {
        colEnd ++;
    }

    let slice = lineText.slice(colStart, colEnd);
    let segments: string[] = seg(slice);
    
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