import * as vscode from 'vscode'

export enum ChinesePartitioningRule {
    ByCharacters,
    ByWords,
    BySentences
}

export interface IConfig {
    chinesePartitioningRule: ChinesePartitioningRule;
}

export function parseConfig(): IConfig {
    let config: IConfig = {
        chinesePartitioningRule: ChinesePartitioningRule.ByWords
    };
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
    return config;
}
