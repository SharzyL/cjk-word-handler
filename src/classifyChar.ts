import { Range, TextDocument } from "vscode";

export enum CharClass {
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

export function isHanChar(charCode : number) : boolean {
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

/**
 * Compose a character classifier function.
 * @param wordSeparators A string containing characters to separate words
 *                       (mostly used in English-like language context.)
 */
export function makeClassifier(wordSeparators: string) {
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
