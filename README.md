# CJK Word Handler

[![zlib license](https://img.shields.io/badge/license-zlib-lightgray.svg?longCache=true&style=popout)](https://github.com/sgryjp/japanese-word-handler/blob/master/LICENSE)

Better cursor movement in CJK language text for [VS Code](https://code.visualstudio.com). 

This is an extension directly modified from another extension [Japanese Word Handler](https://marketplace.visualstudio.com/items?itemName=sgryjp.japanese-word-handler) developed by [sgryjp](https://github.com/sgryjp). [Node segment](https://github.com/leizongmin/node-segment) is used for Chinese word segmentation. 

## Usage

VSCode partitions English text into words by spaces and English punctuations. Then users can move the cursor by words instead of by characters when <kbd>ctrl</kbd> is pressed. However, because this partitioning strategy does not work correctly for CJK language text, this feature behaves badly with these languages. For example, <kbd>ctrl</kbd> + <kbd>Right</kbd> will make the cursor move directly to the end of line in Chinese environment. This extension aims to solve this problem. 

Just install the extension. Doing so changes the action for the keybindings
below (on macOS, use <kbd>⌥Option</kbd> instead of <kbd>Ctrl</kbd>):

* <kbd>Ctrl</kbd>+<kbd>Right</kbd>
* <kbd>Ctrl</kbd>+<kbd>Left</kbd>
* <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Right</kbd>
* <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Left</kbd>
* <kbd>Ctrl</kbd>+<kbd>Delete</kbd>
* <kbd>Ctrl</kbd>+<kbd>Backspace</kbd>

Although not visible in command platte, these actions are implemented as commands so that you can reassign any key combinations to them. 

A configuration is provided to customize the partitioning strategy. By default we partition Chinese into words via node segment. We can adjust the strategy by changing `cjkWordHandler.chinesePartitioningRule` to "By characters" or "By sentences". 

## Known limitations

Due to the limitation of node segment, there will be a delay of one second or so at the first time using this extension. 

As of VSCode 1.41.0, extension cannot override word related actions below:

* Word selection on double click
* Automatic highlight of a word at where the cursor is
* 'Match Whole Word' option of text search

## Issue report

Please visit the [project's GitHub page](https://github.com/SharzyL/cjk-word-handler) and report it. Contributions are welcome. 

**Enjoy!**
