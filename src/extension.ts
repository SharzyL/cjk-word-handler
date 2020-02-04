'use strict';

import * as vscode from 'vscode';
import { Position, Range, Selection, TextDocument, TextEditor } from 'vscode';

//-----------------------------------------------------------------------------
export function activate(context: vscode.ExtensionContext) {
    function registerCommand(name: string, logic: Function) {
        let command = vscode.commands.registerCommand(
            name,
            () => {
                let editor = vscode.window.activeTextEditor!;
                let wordSeparators = vscode.workspace
                    .getConfiguration("editor", editor.document.uri)
                    .get("wordSeparators");
                logic(editor, wordSeparators);
            });
        context.subscriptions.push(command);
    };

    // Register commands
    registerCommand('japaneseWordHandler.cursorWordEndLeft', cursorWordEndLeft);
    registerCommand('japaneseWordHandler.cursorWordEndLeftSelect', cursorWordEndLeftSelect);
    registerCommand('japaneseWordHandler.cursorWordEndRight', cursorWordEndRight);
    registerCommand('japaneseWordHandler.cursorWordEndRightSelect', cursorWordEndRightSelect);
    registerCommand('japaneseWordHandler.cursorWordStartLeft', cursorWordStartLeft);
    registerCommand('japaneseWordHandler.cursorWordStartLeftSelect', cursorWordStartLeftSelect);
    registerCommand('japaneseWordHandler.cursorWordStartRight', cursorWordStartRight);
    registerCommand('japaneseWordHandler.cursorWordStartRightSelect', cursorWordStartRightSelect);
    registerCommand('japaneseWordHandler.deleteWordEndLeft', deleteWordEndLeft);
    registerCommand('japaneseWordHandler.deleteWordEndRight', deleteWordEndRight);
    registerCommand('japaneseWordHandler.deleteWordStartLeft', deleteWordStartLeft);
    registerCommand('japaneseWordHandler.deleteWordStartRight', deleteWordStartRight);

    // Register legacy commands for compatibility
    registerCommand('extension.cursorWordEndRight', cursorWordEndRight);
    registerCommand('extension.cursorWordEndRightSelect', cursorWordEndRightSelect);
    registerCommand('extension.cursorWordStartLeft', cursorWordStartLeft);
    registerCommand('extension.cursorWordStartLeftSelect', cursorWordStartLeftSelect);
    registerCommand('extension.deleteWordRight', deleteWordEndRight);
    registerCommand('extension.deleteWordLeft', deleteWordStartLeft);
}

//-----------------------------------------------------------------------------
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

function _delete(
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

export function cursorWordEndLeft(editor: TextEditor, wordSeparators: string) {
    _move(editor, wordSeparators, findPreviousWordEnd);
}

export function cursorWordEndLeftSelect(editor: TextEditor, wordSeparators: string) {
    _select(editor, wordSeparators, findPreviousWordEnd);
}

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

export function cursorWordStartRight(editor: TextEditor, wordSeparators: string) {
    _move(editor, wordSeparators, findNextWordStart);
}

export function cursorWordStartRightSelect(editor: TextEditor, wordSeparators: string) {
    _select(editor, wordSeparators, findNextWordStart);
}

export function deleteWordEndLeft(editor: TextEditor, wordSeparators: string) {
    return _delete(editor, wordSeparators, findPreviousWordEnd);
}

export function deleteWordEndRight(editor: TextEditor, wordSeparators: string) {
    return _delete(editor, wordSeparators, findNextWordEnd);
}

export function deleteWordStartLeft(editor: TextEditor, wordSeparators: string) {
    return _delete(editor, wordSeparators, findPreviousWordStart);
}

export function deleteWordStartRight(editor: TextEditor, wordSeparators: string) {
    return _delete(editor, wordSeparators, findNextWordStart);
}

//-----------------------------------------------------------------------------
enum CharClass {
    Alnum,
    Whitespace,
    Punctuation,
    Hiragana,
    Katakana,
    Chinese,
    Other,
    Separator,
    Invalid
}

/**
 * Gets position of the start of a word after specified position.
 */
function findNextWordStart(
    doc: TextDocument,
    caretPos: Position,
    wordSeparators: string
): Position {
    // If the cursor is at an end-of-document, return original position.
    // If the cursor is at an end-of-line, return position of the next line.
    // Find ending position of a sequence starting with the character at
    // cursor. Then, return position of where WSPs following the sequence end.

    const classify = makeClassifier(wordSeparators);

    // Check if it's already at end-of-line or end-of-document
    let klass = classify(doc, caretPos.line, caretPos.character);
    if (klass === CharClass.Invalid) {
        const nextLine = caretPos.line + 1;
        return (nextLine < doc.lineCount)
            ? new Position(nextLine, 0) // end-of-line
            : caretPos;                 // end-of-document
    }

    // Seek until character type changes, unless already reached EOL/EOD
    let pos = caretPos;
    klass = classify(doc, pos.line, pos.character);
    if (classify(doc, pos.line, pos.character) !== CharClass.Invalid) {
        do {
            pos = new Position(pos.line, pos.character + 1);
        }
        while (klass === classify(doc, pos.line, pos.character));
    }

    // Skip a series of whitespaces
    while (classify(doc, pos.line, pos.character) === CharClass.Whitespace) {
        pos = new Position(pos.line, pos.character + 1);
    }

    return pos;
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

    // Check if it's already at end-of-line or end-of-document
    let klass = classify(doc, caretPos.line, caretPos.character);
    if (klass === CharClass.Invalid) {
        const nextLine = caretPos.line + 1;
        return (nextLine < doc.lineCount)
            ? new Position(nextLine, 0) // end-of-line
            : caretPos;                 // end-of-document
    }

    // Skip a series of whitespaces
    let pos = caretPos;
    if (klass === CharClass.Whitespace) {
        do {
            pos = new Position(pos.line, pos.character + 1);
        }
        while (classify(doc, pos.line, pos.character) === CharClass.Whitespace);
    }

    // Seek until character type changes, unless already reached EOL/EOD
    klass = classify(doc, pos.line, pos.character);
    if (classify(doc, pos.line, pos.character) !== CharClass.Invalid) {
        do {
            pos = new Position(pos.line, pos.character + 1);
        }
        while (klass === classify(doc, pos.line, pos.character));
    }

    return pos;
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

    // Firstly skip whitespaces, excluding EOL codes.
    function prevCharIsWhitespace() {
        let prevPos = doc.positionAt(doc.offsetAt(pos) - 1);
        return (classify(doc, prevPos.line, prevPos.character) === CharClass.Whitespace);
    }
    let pos = caretPos;
    while (prevCharIsWhitespace()) {
        // Intentionally avoiding to use doc.positionAt(doc.offsetAt())
        // so that the seek stops at the EOL.
        if (pos.character <= 0) {
            return doc.positionAt(doc.offsetAt(pos) - 1);
        }
        pos = new Position(pos.line, pos.character - 1);
    }

    // Then, seek until the character type changes.
    pos = doc.positionAt(doc.offsetAt(pos) - 1);
    const initKlass = classify(doc, pos.line, pos.character);
    let prevPos = doc.positionAt(doc.offsetAt(pos) - 1);
    while (prevPos.isBefore(pos)) {
        if (initKlass !== classify(doc, prevPos.line, prevPos.character)) {
            break;
        }

        pos = prevPos;
        prevPos = doc.positionAt(doc.offsetAt(pos) - 1);
    }

    return pos;
}

/**
 * Gets position of where a word before specified position ends.
 */
function findPreviousWordEnd(
    doc: TextDocument,
    caretPos: Position,
    wordSeparators: string
) {
    const classify = makeClassifier(wordSeparators);

    let pos = caretPos;
    if (pos.character == 0) {
        if (pos.line == 0) {
            return pos;  // start of document
        } else {
            return doc.positionAt(doc.offsetAt(pos) - 1);  // start of a line
        }
    }
    //assert 0 < pos.character

    // Seek until character type changes, unless already reached EOL/EOD
    let klass: CharClass;
    let initKlass = classify(doc, pos.line, pos.character - 1);
    do {
        pos = new Position(pos.line, pos.character - 1);
        klass = classify(doc, pos.line, pos.character - 1);
    }
    while (klass === initKlass);

    if (klass == CharClass.Whitespace) {
        do {
            pos = new Position(pos.line, pos.character - 1);
            klass = classify(doc, pos.line, pos.character - 1);
        }
        while (klass == CharClass.Whitespace);
    }

    return pos;
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
            || (0x3001 <= ch && ch <= 0x303f
                && ch !== 0x3005)               // CJK punctuation marks except Ideographic iteration mark
            || ch === 0x30fb                    // Katakana middle dot
            || (0xff01 <= ch && ch <= 0xff0f)   // "Full width" forms (1)
            || (0xff1a <= ch && ch <= 0xff20)   // "Full width" forms (2)
            || (0xff3b <= ch && ch <= 0xff40)   // "Full width" forms (3)
            || (0xff5b <= ch && ch <= 0xff65)   // "Full width" forms (4)
            || (0xffe0 <= ch && ch <= 0xffee)) {// "Full width" forms (5)
            return CharClass.Punctuation;
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

        if (0x3200 <= ch && ch <= 0x9fff) {
            return CharClass.Chinese;
        }

        return CharClass.Other;
    };
}
