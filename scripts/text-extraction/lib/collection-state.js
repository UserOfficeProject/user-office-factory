var _ = require('lodash');

function initTextState() {
    return  {
            charSpace:0,
            wordSpace:0,
            scale:100,
            leading:0,
            rise:0,
            font:null,
            tm: [1,0,0,1,0,0],
            tlm: [1,0,0,1,0,0],
            tmDirty:true,
            tlmDirty:true
        };
}

function cloneTextEnv(env) {
    return {
            charSpace:env.charSpace,
            wordSpace:env.wordSpace,
            scale:env.scale,
            leading:env.leading,
            rise:env.rise,
            font:env.font ? _.extend({},env.font):env.font,
            tm:env.tm.slice(),
            tlm:env.tlm.slice(),
            tmDirty:env.tmDirty,
            tlmDirty:env.tlmDirty
        }
}

function cloneGraphicEnv(env) {
    return {
        ctm:env.ctm.slice(),
        text:cloneTextEnv(env.text)
    }
}

class CollectionState {
    constructor() {
        this.graphicStateStack = [{
            ctm: [1, 0, 0, 1, 0, 0],
            text: initTextState()
        }];
        this.inTextElement = false;
        this.textElementTextStack = null;
        this.texts = null;
    }
    pushGraphicState() {
        this.graphicStateStack.push(cloneGraphicEnv(this.graphicStateStack[this.graphicStateStack.length - 1]));
        if (this.inTextElement) {
            this.textElementTextStack.push(cloneTextEnv(this.textElementTextStack[this.textElementTextStack.length - 1]));
        }
    }
    popGraphicState() {
        if (this.graphicStateStack.length > 1)
            this.graphicStateStack.pop();
        if (this.inTextElement && this.textElementTextStack.length > 1)
            this.textElementTextStack.pop();
    }
    currentGraphicState() {
        return this.graphicStateStack[this.graphicStateStack.length - 1];
    }
    currentTextState() {
        if (this.inTextElement) {
            return this.textElementTextStack[this.textElementTextStack.length - 1];
        }
        else {
            return this.graphicStateStack[this.graphicStateStack.length - 1].text;
        }
    }
    cloneCurrentTextState() {
        return cloneTextEnv(this.currentTextState());
    }
    startTextElement() {
        this.inTextElement = true;
        this.textElementTextStack = [cloneTextEnv(this.currentGraphicState().text)];
        this.texts = [];
    }
    endTextElement(placements) {

        // save text properties to persist after gone (some of them...)
        var latestTextState = this.cloneCurrentTextState();
        this.inTextElement = false;
        this.textElementTextStack = null;

        placements.push({
            type: 'text',
            text: this.texts
        });
        this.texts = null;

        // copy persisted data to top text state
        var persistingTextState = this.currentTextState();
        ['charSpace', 'wordSpace', 'scale', 'leading', 'rise', 'font'].forEach((name) => {
            persistingTextState[name] = latestTextState[name];
        });
    }
}

module.exports = CollectionState;