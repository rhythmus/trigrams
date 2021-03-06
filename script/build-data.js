/**
 * @author Titus Wormer
 * @copyright 2014 Titus Wormer
 * @license MIT
 * @module trigrams:script
 * @fileoverview Build databases from `udhr`.
 */

'use strict';

/* eslint-env node */

/* eslint-disable no-console */

/*
 * Dependencies.
 */

var udhr = require('udhr');
var fs = require('fs');
var trigramUtils = require('trigram-utils');

/*
 * Cached methods.
 */

var writeFile = fs.writeFileSync;

/*
 * Data.
 */

var json = udhr.json();
var information = udhr.information();

/*
 * Variables to keep track of some information.
 */

var highestTrigramCount = 0;
var highestTrigram;
var highestTrigramLanguage;

/**
 * Get all keys, recursively, in an object.
 *
 * @param {Object} object - Context object.
 * @param {string} key - Key to get.
 * @return {Array.<*>} - Results.
 */
function all(object, key) {
    var results = [];
    var property;
    var value;

    for (property in object) {
        value = object[property];

        if (property === key) {
            results.push(value);
        } else if (typeof value === 'object') {
            results = results.concat(all(value, key));
        }
    }

    return results;
}

/**
 * Create an `index` file.
 *
 * @param {string} type - Name.
 */
function createIndexFile(type) {
    var queue = [];

    /**
     * Add a file to the index.
     *
     * @param {string} code - Language code.
     */
    function addFile(code) {
        queue.push({
            'code': code,
            'path': code + '.json'
        });
    }

    /**
     * Get the value of the index.
     *
     * @return {string} JavaScript representation of
     *   the index.
     */
    function done() {
        var lines = queue.map(function (file) {
            return '\'' + file.code +
                '\': require(\'./' + type + '/' + file.path + '\')';
        });

        return '\'use strict\';\n' +
            '\n' +
            '/* eslint-env commonjs */\n' +
            '\n' +
            'module.exports = {\n' +
            '    ' + lines.join(',\n    ') + '\n' +
            '};\n';
    }

    /**
     * Get the number of files in the index.
     *
     * @return {number} - Length.
     */
    function count() {
        return queue.length;
    }

    return {
        'toString': done,
        'add': addFile,
        'count': count
    };
}

/*
 * Automated index files.
 */

var allIndex = createIndexFile('all');
var minIndex = createIndexFile('min');
var topIndex = createIndexFile('top');

/*
 * Create data.
 */

Object.keys(json).forEach(function (code) {
    var plain = all(json[code], 'para').join('');
    var trigrams = trigramUtils.asTuples(plain);
    var topTrigrams = trigrams.slice(-300);
    var trigram = topTrigrams[topTrigrams.length - 1];
    var language = information[code].name;
    var totalTopTrigramOccurrences;

    totalTopTrigramOccurrences = topTrigrams.reduce(function (a, b) {
        return a + b[1];
    }, 0);

    console.log(
        'Writing trigram file for: ' + language + '\n' +
        '- Code:                  "' + code + '";\n' +
        '- Highest trigram:       "' + trigram[0] + '";\n' +
        '- Highest trigram count:  ' + trigram[1] + ';\n' +
        '- Total trigrams:         ' + trigrams.length + ';\n' +
        '- Top trigrams count:     ' + totalTopTrigramOccurrences + ';\n' +
        '- String length:          ' + plain.length + ';'
    );

    if (trigram[1] > highestTrigramCount) {
        highestTrigramCount = trigram[1];
        highestTrigram = trigram[0];
        highestTrigramLanguage = language;
    }

    allIndex.add(code);

    writeFile('./data/all/' + code + '.json', JSON.stringify(
        trigramUtils.tuplesAsDictionary(trigrams), 0, 2
    ));

    if (
        topTrigrams.length === 300 &&
        trigram[1] > 30 &&
        (plain.length / totalTopTrigramOccurrences) < 2.5
    ) {
        writeFile('./data/top/' + code + '.json', JSON.stringify(
            trigramUtils.tuplesAsDictionary(topTrigrams), 0, 2
        ));

        writeFile('./data/min/' + code + '.json', JSON.stringify(
            topTrigrams.map(function (trigram) {
                return trigram[0];
            }), 0, 2
        ));

        topIndex.add(code);
        minIndex.add(code);

        console.log(
            '- Top trigram file:       yes;\n' +
            '- Min trigram file:       yes.'
        );
    } else {
        console.log(
            '- Top trigram file:       no;\n' +
            '- Min trigram file:       no.'
        );
    }

    console.log('');
});

/*
 * Log information regarding the highest trigram.
 */

console.log(
    'The highest trigram was "' + highestTrigram + '" which occurred ' +
    highestTrigramCount + ' times in ' + highestTrigramLanguage + '.\n'
);

/*
 * Write the file containing all trigrams.
 */

writeFile('./data/all.js', allIndex);

console.log(
    'Finished writing ' + allIndex.count() + ' files.\n'
);

/*
 * Write the file containing top trigrams.
 */

writeFile('./data/top.js', topIndex);

console.log(
    'Finished writing ' + topIndex.count() + ' top files ' +
    '(ignoring ' + (allIndex.count() - topIndex.count()) + ').\n'
);

/*
 * Write the file containing top trigrams as an array.
 */

writeFile('./data/min.js', minIndex);

console.log(
    'Finished writing ' + minIndex.count() + ' min files ' +
    '(ignoring ' + (allIndex.count() - minIndex.count()) + ').\n'
);
