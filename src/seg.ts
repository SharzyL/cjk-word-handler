import { ChinesePartitioningRule } from "./config";

const Segment = require('segment');

export const segment = new Segment();

export function segInit() {
    segment.useDefault();
}

export function seg(str: string, rule: ChinesePartitioningRule): string[] {
    switch (rule) {
        case ChinesePartitioningRule.ByCharacters:
            return str.split('');
        case ChinesePartitioningRule.BySentences:
            return [str];
        case ChinesePartitioningRule.ByWords:
            return segment.doSegment(str, {simple: true});
    }
}
