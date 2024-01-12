import { TextEditor, Selection } from "vscode";

export function _move(
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

export function _select(
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

export async function _delete(
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
