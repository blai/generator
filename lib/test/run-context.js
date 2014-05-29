'use strict';
var _ = require('lodash');
var yeoman = require('../..');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var helpers = require('./helpers');

/**
 * This class provide a run context object to façade the complexity involved in setting
 * up a generator for testing
 * @constructor
 * @param  {String|Function} Generator - Namespace or generator constructor. If the later
 *                                       is provided, then namespace is assumed to be
 *                                       'gen:test' in all cases
 * @return {this}
 */

var RunContext = module.exports = function RunContext(Generator) {
  this._asyncHolds = 0;
  this.runned = false;
  this.args = [];
  this.options = {};
  this._dependencies = [];
  this.Generator = Generator;

  setTimeout(this._onReady.bind(this), 0);
};

util.inherits(RunContext, EventEmitter);

/**
 * Hold the execution until the returned callback is triggered
 * @private
 * @return {Function} Callback to notify the normal execution can resume
 */

RunContext.prototype._holdExec = function () {
  this._asyncHolds++;
  return function () {
    this._asyncHolds--;
    this._onReady();
  }.bind(this);
};

/**
 * Method called when the context is ready to run the generator
 * @private
 */

RunContext.prototype._onReady = function () {
  if (this._asyncHolds !== 0 || this.runned) return;
  this.runned = true;

  var namespace;
  this.env = yeoman();

  this._dependencies.forEach(function (d) {
    if (d instanceof Array) {
      this.env.registerStub(d[0], d[1]);
    } else {
      this.env.register(d);
    }
  }.bind(this));

  if (_.isString(this.Generator)) {
    namespace = this.env.namespace(this.Generator);
    this.env.register(this.Generator);
  } else {
    namespace = 'gen:test';
    this.env.registerStub(this.Generator, namespace);
  }

  this.generator = this.env.create(namespace);
  helpers.mockPrompt(this.generator, this._answers);

  this.generator.args = this.args;
  this.generator.arguments = this.args;
  this.generator.options = _.extend({
    'skip-install': true
  }, this.options);

  this.emit('ready', this.generator);
  this.generator.run(this._end);
};

/**
 * Clean the provided directory, then change directory into it
 * @param  {String} dirPath - Directory path (relative to CWD). Prefer passing an absolute
 *                            file path for predictable results
 * @return {this}
 */

RunContext.prototype.inDir = function (dirPath) {
  var release = this._holdExec();
  helpers.testDirectory(dirPath, release);
  return this;
};

/**
 * Provide arguments to the run context
 * @param  {String|Array} args - command line arguments as Array or space separated string
 * @return {this}
 */

RunContext.prototype.withArguments = function (args) {
  this.args = _.isString(args) ? args.split(' ') : args;
  return this;
};

/**
 * Provide options to the run context
 * @param  {Object} options - command line options (e.g. `--opt-one=foo`)
 * @return {this}
 */

RunContext.prototype.withOptions = function (options) {
  this.options = options;
  return this;
};

/**
 * Mock the prompt with dummy answers
 * @param  {Object} answers - Answers to the prompt questions
 * @return {this}
 */

RunContext.prototype.withPrompt = function (answers) {
  this._answers = answers;
  return this;
};

/**
 * Provide denpendent generators
 * @param {Array} dependencies - paths to the generators dependencies
 * @return {this}
 * @example
 *  var deps = ['../../common',
 *              '../../controller',
 *              '../../main',
 *              [helpers.createDummyGenerator(), 'testacular:app']
 *            ];
 * var angular = new RunContext('../../app');
 * angular.withGenerator(deps);
 * angular.withPrompt({
 *   compass: true,
 *   bootstrap: true
 * });
 * angular.onEnd(function () {
 *   // assert something
 * });
 */

RunContext.prototype.withGenerators = function (dependencies) {
  this._dependencies = dependencies || [];
  return this;
};

/**
 * Add a callback to be called after the generator has ran
 * @param  {Function} callback
 * @return {this}
 */

RunContext.prototype.onEnd = function (cb) {
  this._end = cb;
  return this;
};
