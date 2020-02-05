// Note: This test is leveraging the Mocha test framework (https://mochajs.org/)

import * as assert from 'assert';
import * as vscode from 'vscode';
import { Position, Range, Selection, TextEditor, TextEditorEdit, EndOfLine } from 'vscode';

import * as myExtension from '../extension';


suite("japanese-word-handler", () => {
    // Prepare utility functions and constants
    const setText = async function (editor: TextEditor, text: string) {
        return editor.edit((editBuilder: TextEditorEdit) => {
            const doc = editor.document;
            const startPos = new Position(0, 0);
            const lastLine = doc.lineAt(doc.lineCount - 1);
            const endPos = lastLine.range.end;
            const entireRange = new Range(startPos, endPos);
            editBuilder.replace(entireRange, text);
            editBuilder.setEndOfLine(EndOfLine.LF);
        });
    };

    suiteSetup(async () => {
        const uri = vscode.Uri.parse("untitled:test.txt");
        await vscode.window.showTextDocument(uri);
    });

    suiteTeardown(async () => {
        const commandName = "workbench.action.closeAllEditors";
        await vscode.commands.executeCommand(commandName);
    });

    suite("cursorWordEndRight", () => {

        const testSingleCursorMotion = async function (
            editor: TextEditor,
            wordSeparators: string,
            content: string
        ) {
            await setText(editor, content);
            const initPos = new Position(0, 0);
            editor.selections = [new Selection(initPos, initPos)];
            myExtension.cursorWordEndRight(editor, wordSeparators);
            return editor.selection.active;
        };

        test("motion: starting from end-of-document",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", "");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 0);
            });

        test("motion: starting from end-of-line",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", "\n");
                assert.equal(cursorPos.line, 1);
                assert.equal(cursorPos.character, 0);
            });

        test("motion: should skip a WSP at cursor",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", " Foo");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 4);
            });

        test("motion: should skip multiple WSPs at cursor",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", " \t Foo");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 6);
            });

        test("motion: should stop at end-of-document after skipping WSPs",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", " ");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 1);
            });

        test("motion: should stop at beginning of a line just after an EOL",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "\norange");
                assert.equal(cursorPos.line, 1);
                assert.equal(cursorPos.character, 0);
            });

        test("motion: should skip only the first EOL in a series of EOLs",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "\n\norange");
                assert.equal(cursorPos.line, 1);
                assert.equal(cursorPos.character, 0);
            });

        test("motion: should stop on char-class change (alnum -> punctuation)",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", "HbA1c。");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 5);
            });

        test("motion: should stop on char-class change (alnum -> hiragana)",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", "HbA1cかな");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 5);
            });

        test("motion: should stop on char-class change (hiragana -> katakana)",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", "かなカナ");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 2);
            });

        test("motion: should stop on char-class change (katakana -> other)",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", "カナ漢字");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 2);
            });

        test("motion: should stop on char-class change (other -> WSP)",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", "漢字\t ");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 2);
            });

        test("motion: should stop at end-of-line",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "apple\norange");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 5);
            });

        test("motion: should stop at end-of-document",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "apple");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 5);
            });
    });

    suite("cursorWordStartLeft", () => {

        const testSingleCursorMotion = async function (
            editor: TextEditor,
            wordSeparators: string,
            content: string
        ) {
            await setText(editor, content);
            const initPos = editor.document.positionAt(
                content.length * 2); // LFs may become CRLFs
            editor.selections = [new Selection(initPos, initPos)];
            myExtension.cursorWordStartLeft(editor, wordSeparators);
            return editor.selection.active;
        };

        test("motion: starting from start-of-document",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", "");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 0);
            });

        test("motion: starting from start-of-line",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", "\n");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 0);
            });

        test("motion: should skips a WSP",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", "Foo ");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 0);
            });

        test("motion: should skip multiple WSPs",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", "Foo \t");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 0);
            });

        test("motion: should stop at start-of-document after skipping WSPs",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor,
                    "", " ");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 0);
            });

        test("motion: should not go over an EOL if not from start of the line",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "\nFoo");
                assert.equal(cursorPos.line, 1);
                assert.equal(cursorPos.character, 0);
            });

        test("motion: should go over an EOL from start of the line",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "Foo\n");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 3);
            });

        test("motion: should stop on char-class change (alnum -> punctuation)",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "!HbA1c");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 1);
            });

        test("motion: should stop on char-class change (alnum -> hiragana)",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "かなHbA1c");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 2);
            });

        test("motion: should stop on char-class change (hiragana -> katakana)",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "カナかな");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 2);
            });

        test("motion: should stop on char-class change (katakana -> other)",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "漢字カナ");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 2);
            });

        test("motion: should stop on char-class change (other -> WSP)",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "\t 漢字");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 2);
            });

        test("motion: should stop at start-of-line",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "Foo\nBar");
                assert.equal(cursorPos.line, 1);
                assert.equal(cursorPos.character, 0);
            });

        test("motion: should stop at start-of-document",
            async () => {
                const editor = vscode.window.activeTextEditor!;
                const cursorPos = await testSingleCursorMotion(editor, "",
                    "Foo");
                assert.equal(cursorPos.line, 0);
                assert.equal(cursorPos.character, 0);
            });
    });

    suite("deleteWordEndRight", () => {
        const doMine = async function (
            editor: TextEditor,
            wordSeparators: string,
            content: string
        ) {
            await setText(editor, content);
            const initPos = new Position(0, 0);
            editor.selections = [new Selection(initPos, initPos)];
            await myExtension.deleteWordEndRight(editor, wordSeparators);
            return editor.document.getText();
        };

        const doTheirs = async function (
            editor: TextEditor,
            command: string,
            content: string
        ) {
            await setText(editor, content);
            const initPos = new Position(0, 0);
            editor.selections = [new Selection(initPos, initPos)];
            await vscode.commands.executeCommand(command);
            return editor.document.getText();
        };

        // Range
        [
            { name: ".", input: "", expected: "", compatible: true, },

            { name: "A.", input: "aa", expected: "", compatible: true, },
            { name: "AH", input: "aaあ", expected: "あ", compatible: false, },
            { name: "AK", input: "aaア", expected: "ア", compatible: false, },
            { name: "AJ", input: "aa亜", expected: "亜", compatible: false, },
            { name: "AL", input: "aa\n", expected: "\n", compatible: true, },
            { name: "AS", input: "aa ", expected: " ", compatible: true, },

            { name: "H.", input: "ああ", expected: "", compatible: true, },
            { name: "HA", input: "ああa", expected: "a", compatible: false, },
            { name: "HK", input: "ああア", expected: "ア", compatible: false, },
            { name: "HJ", input: "ああ亜", expected: "亜", compatible: false, },
            { name: "HL", input: "ああ\n", expected: "\n", compatible: true, },
            { name: "HS", input: "ああ ", expected: " ", compatible: true, },

            { name: "K.", input: "アア", expected: "", compatible: true, },
            { name: "KA", input: "アアa", expected: "a", compatible: false, },
            { name: "KH", input: "アアあ", expected: "あ", compatible: false, },
            { name: "KJ", input: "アア亜", expected: "亜", compatible: false, },
            { name: "KL", input: "アア\n", expected: "\n", compatible: true, },
            { name: "KS", input: "アア ", expected: " ", compatible: true, },

            { name: "J.", input: "亜亜", expected: "", compatible: true, },
            { name: "JA", input: "亜亜a", expected: "a", compatible: false, },
            { name: "JH", input: "亜亜あ", expected: "あ", compatible: false, },
            { name: "JK", input: "亜亜ア", expected: "ア", compatible: false, },
            { name: "JL", input: "亜亜\n", expected: "\n", compatible: true, },
            { name: "JS", input: "亜亜 ", expected: " ", compatible: true, },

            { name: "L.", input: "\n", expected: "", compatible: true, },
            { name: "LA", input: "\na", expected: "a", compatible: true, },
            { name: "LH", input: "\nあ", expected: "あ", compatible: false },
            { name: "LK", input: "\nア", expected: "ア", compatible: false },
            { name: "LJ", input: "\n亜", expected: "亜", compatible: false },
            { name: "LL", input: "\n\n", expected: "\n", compatible: true, },
            { name: "LS.", input: "\n ", expected: " ", compatible: false, },  //TODO: should be compatible

            { name: "S.", input: " ", expected: "", compatible: true, },
            { name: "SA.", input: " aa", expected: "", compatible: true, },
            { name: "SAL", input: " aa\n", expected: "\n", compatible: true, },
            { name: "SAS", input: " aa ", expected: " ", compatible: true, },
            { name: "SH.", input: " ああ", expected: "", compatible: true, },
            { name: "SHL", input: " ああ\n", expected: "\n", compatible: true, },
            { name: "SHS", input: " ああ ", expected: " ", compatible: true, },
            { name: "SK.", input: " アア", expected: "", compatible: true, },
            { name: "SKL", input: " アア\n", expected: "\n", compatible: true, },
            { name: "SKS", input: " アア ", expected: " ", compatible: true, },
            { name: "SJ.", input: " 亜亜", expected: "", compatible: true, },
            { name: "SJL", input: " 亜亜\n", expected: "\n", compatible: true, },
            { name: "SJS", input: " 亜亜 ", expected: " ", compatible: true, },
            { name: "SL", input: " \n", expected: "\n", compatible: true, },
            { name: "SS.", input: "  ", expected: "", compatible: true, },
            { name: "SSA.", input: "  aa", expected: "", compatible: false, },
            { name: "SSL", input: "  \n", expected: "\n", compatible: true, },
        ].forEach(t => {
            test("range: " + t.name, async () => {
                const editor = vscode.window.activeTextEditor!;
                const mine = await doMine(editor, "", t.input);
                if (mine !== t.expected) {
                    assert.fail("Unexpected result: {" +
                        escape`input: "${t.input}", ` +
                        escape`expected: "${t.expected}", ` +
                        escape`got: "${mine}"}`
                    );
                }
                if (t.compatible) {
                    const cmd = "deleteWordEndRight";
                    const theirs = await doTheirs(editor, cmd, t.input);
                    if (mine !== theirs) {
                        assert.fail("Incompatible behavior: {" +
                            escape`input: "${t.input}", ` +
                            escape`mine: "${mine}", ` +
                            escape`theirs: "${theirs}"}`
                        );
                    }
                }
            });
        });

        test("undo",
            async () => {
                const editor = vscode.window.activeTextEditor!;

                // Execute my command
                const mine = await doMine(editor, "", "abc");
                assert.equal(mine, "");

                // Undo and check the result
                await vscode.commands.executeCommand("undo");
                const text = await editor.document.getText();
                assert.equal(text, "abc");
            });
    });

    suite("deleteWordStartLeft", () => {
        const doMine = async function (
            editor: TextEditor,
            wordSeparators: string,
            content: string
        ) {
            await setText(editor, content);
            const initPos = editor.document.positionAt(
                content.length * 2); // LFs may become CRLFs
            editor.selections = [new Selection(initPos, initPos)];
            await myExtension.deleteWordStartLeft(editor, wordSeparators);
            return editor.document.getText();
        };

        const doTheirs = async function (
            editor: TextEditor,
            content: string
        ) {
            await setText(editor, content);
            const initPos = editor.document.positionAt(
                content.length * 2); // LFs may become CRLFs
            editor.selections = [new Selection(initPos, initPos)];
            await vscode.commands.executeCommand("deleteWordStartLeft");
            return editor.document.getText();
        };

        // Range
        [
            { name: ".", input: "", expected: "", compatible: true },

            { name: "A.", input: "aa", expected: "", compatible: true },
            { name: "AH", input: "あaa", expected: "あ", compatible: false },
            { name: "AK", input: "アaa", expected: "ア", compatible: false },
            { name: "AJ", input: "亜aa", expected: "亜", compatible: false },
            { name: "AL", input: "\naa", expected: "\n", compatible: true },
            { name: "AS", input: " aa", expected: " ", compatible: true },

            { name: "H.", input: "ああ", expected: "", compatible: true },
            { name: "HA", input: "aああ", expected: "a", compatible: false },
            { name: "HK", input: "アああ", expected: "ア", compatible: false },
            { name: "HJ", input: "亜ああ", expected: "亜", compatible: false },
            { name: "HL", input: "\nああ", expected: "\n", compatible: true },
            { name: "HS", input: " ああ", expected: " ", compatible: true },

            { name: "K.", input: "アア", expected: "", compatible: true },
            { name: "KA", input: "aアア", expected: "a", compatible: false },
            { name: "KH", input: "あアア", expected: "あ", compatible: false },
            { name: "KJ", input: "亜アア", expected: "亜", compatible: false },
            { name: "KL", input: "\nアア", expected: "\n", compatible: true },
            { name: "KS", input: " アア", expected: " ", compatible: true },

            { name: "J.", input: "亜亜", expected: "", compatible: true },
            { name: "JA", input: "a亜亜", expected: "a", compatible: false },
            { name: "JH", input: "あ亜亜", expected: "あ", compatible: false },
            { name: "JK", input: "ア亜亜", expected: "ア", compatible: false },
            { name: "JL", input: "\n亜亜", expected: "\n", compatible: true },
            { name: "JS", input: " 亜亜", expected: " ", compatible: true },

            { name: "L.", input: "\n", expected: "", compatible: true },
            { name: "LA", input: "a\n", expected: "a", compatible: true },
            { name: "LH", input: "あ\n", expected: "あ", compatible: false },
            { name: "LK", input: "ア\n", expected: "ア", compatible: false },
            { name: "LJ", input: "亜\n", expected: "亜", compatible: false },
            //BUG//{ name: "LL", input: "\n\n", expected: "\n", compatible: true },  //TODO: fix this
            { name: "LS.", input: " \n", expected: " ", compatible: false },  //TODO: should be compatible

            { name: "S.", input: " ", expected: "", compatible: true },
            { name: "SA.", input: "aa ", expected: "", compatible: true },
            { name: "SAL", input: "\naa ", expected: "\n", compatible: true },
            { name: "SAS", input: " aa ", expected: " ", compatible: true },
            { name: "SH.", input: "ああ ", expected: "", compatible: true },
            { name: "SHL", input: "\nああ ", expected: "\n", compatible: true },
            { name: "SHS", input: " ああ ", expected: " ", compatible: true },
            { name: "SK.", input: "アア ", expected: "", compatible: true },
            { name: "SKL", input: "\nアア ", expected: "\n", compatible: true },
            { name: "SKS", input: " アア ", expected: " ", compatible: true },
            { name: "SJ.", input: "亜亜 ", expected: "", compatible: true },
            { name: "SJL", input: "\n亜亜 ", expected: "\n", compatible: true },
            { name: "SJS", input: " 亜亜 ", expected: " ", compatible: true },
            //BUG//{ name: "SL", input: "\n ", expected: "\n", compatible: true },  //TODO: fix this
            { name: "SS.", input: "  ", expected: "", compatible: true },
            { name: "SSA.", input: "aa  ", expected: "", compatible: false },
            //BUG//{ name: "SSL", input: "\n  ", expected: "\n", compatible: true },  //TODO: fix this
        ].forEach(t => {
            test("range: " + t.name, async () => {
                const editor = vscode.window.activeTextEditor!;
                const mine = await doMine(editor, "", t.input);
                if (mine !== t.expected) {
                    assert.fail("Unexpected result: {" +
                        escape`input: "${t.input}", ` +
                        escape`expected: "${t.expected}", ` +
                        escape`got: "${mine}"}`
                    );
                }
                if (t.compatible) {
                    const theirs = await doTheirs(editor, t.input);
                    if (mine !== theirs) {
                        assert.fail("Incompatible behavior: {" +
                            escape`input: "${t.input}", ` +
                            escape`mine: "${mine}", ` +
                            escape`theirs: "${theirs}"}`
                        );
                    }
                }
            });
        });

        test("undo",
            async () => {
                const editor = vscode.window.activeTextEditor!;

                // Execute my command
                const mine = await doMine(editor, "", "abc");
                assert.equal(mine, "");

                // Undo and check the result
                await vscode.commands.executeCommand("undo");
                const text = await editor.document.getText();
                assert.equal(text, "abc");
            });
    });
});

function escape(template: TemplateStringsArray, ...substitutions: any[]): string {
    return String.raw(template, substitutions)
        .replace(/\n/g, '\\n');
}
