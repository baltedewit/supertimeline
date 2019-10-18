"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var validate_1 = require("../validate");
var _ = require("underscore");
describe('validate', function () {
    var obj = {
        id: 'obj0',
        enable: {},
        layer: '1',
        content: {}
    };
    var keyframe = {
        id: 'obj0',
        enable: {},
        content: {}
    };
    var timeline = [
        {
            id: 'obj0',
            enable: {},
            layer: '1',
            content: {}
        },
        {
            id: 'obj1',
            enable: {},
            layer: '1',
            content: {}
        }
    ];
    test('validateObject', function () {
        expect(function () {
            validate_1.validateObject(obj, true);
        }).not.toThrowError();
        expect(function () {
            var o = _.clone(obj);
            delete o.id;
            validate_1.validateObject(o, true);
        }).toThrowError();
        expect(function () {
            var o = _.clone(obj);
            delete o.enable;
            validate_1.validateObject(o, true);
        }).toThrowError();
        expect(function () {
            var o = _.clone(obj);
            delete o.layer;
            validate_1.validateObject(o, true);
        }).toThrowError();
        expect(function () {
            var o = _.clone(obj);
            delete o.content;
            validate_1.validateObject(o, true);
        }).toThrowError();
    });
    test('validateKeyframe', function () {
        expect(function () {
            validate_1.validateKeyframe(keyframe, true);
        }).not.toThrowError();
        expect(function () {
            var o = _.clone(keyframe);
            delete o.id;
            validate_1.validateKeyframe(o, true);
        }).toThrowError();
        expect(function () {
            var o = _.clone(keyframe);
            delete o.enable;
            validate_1.validateKeyframe(o, true);
        }).toThrowError();
        expect(function () {
            var o = _.clone(keyframe);
            validate_1.validateKeyframe(o, true);
        }).toThrowError();
        expect(function () {
            var o = _.clone(keyframe);
            delete o.content;
            validate_1.validateKeyframe(o, true);
        }).toThrowError();
    });
    test('validateTimeline', function () {
        expect(function () {
            var tl = _.clone(timeline);
            tl[1].id = tl[0].id;
            validate_1.validateTimeline(tl, false);
        }).toThrowError();
    });
});
//# sourceMappingURL=validate.js.map