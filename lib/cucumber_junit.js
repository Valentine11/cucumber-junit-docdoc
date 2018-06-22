let xml = require('xml');

/**
 * Creates a <property> element with the given name and value
 *
 * @method createProperty
 * @param  {String} name    <property>'s name attribute
 * @param  {String} value   <property>'s value attribute
 * @return {Object}         The <property> element
 */
function createProperty(name, value) {
    return {
        property: [{
            _attr: {
                name: name,
                value: value
            }
        }]
    };
}

/**
 * Creates a <failure> element with an failure message
 *
 * @method createFailure
 * @param scenario    scenario name
 * @param feature     feature name
 * @param {Object}    stepJson     Step output from Cucumber.JS
 * @returns {Object}  The <failure> element
 */
function createFailure(scenario, feature, stepJson) {
    return {
        failure: [
            { _attr: { message: stepJson.result.error_message.split("\n").shift() } },
            `Scenario: ${scenario}\nFeature: ${feature}\nStep: ${stepJson.name}\n\n${stepJson.result.error_message}`
        ]
    };
}

/**
 * Creates a <failure> element with an failure message
 *
 * @method createFailure
 * @param scenario    scenario name
 * @param feature     feature name
 * @returns {Object}  The <skipped> element
 */

function createPending(scenario, feature) {
    return {
        skipped: [
            { _attr: { message: 'Scenario skipped' } },
            `Scenario: ${scenario}\nFeature: ${feature}\n\nScenario skipped`
        ]
    };
}

/**
 * Creates a <failure> element with an failure message
 *
 * @method createFailure
 * @param scenario    scenario name
 * @param {Object}    stepJson     Step output from Cucumber.JS
 * @returns {Object}  The <skipped> element
 */

function createUndefined(scenario, stepJson) {
    return {
        undefined: [
            {_attr: {message: stepJson.result.error_message.split("\n").shift()}},
            `Scenario: ${scenario}\nFeature: ${feature}\nStep: ${stepJson.name}\n\n${stepJson.result.error_message}`
        ]
    };
}

/**
 * Convert a scenario from Cucumber.JS into an XML element <testsuite>
 *
 * @method convertScenario
 * @param  {Object}    scenarioJson Scenario output from Cucumber.JS
 * @param  {Object}    options      if `strict` is true, pending or undefined steps will be reported as failures.
 *                                  if `prefix` is provided, it will be added to the testsuite name.
 * @return {Array}                  Array of elements for an XML element <testsuite>
 */
function convertScenario (scenarioJson, options) {
    let scenarioOutput = [{
        _attr: {
            name: scenarioJson.name,
            time: 0
        }
    }];

    if(options.prefix) {
        scenarioOutput[0]._attr.name = options.prefix + scenarioOutput[0]._attr.name;
    }

    if(scenarioJson.steps) {
        let passed = scenarioJson.steps.every(function (stepJson) {
            return stepJson.result.status === 'passed';
        });
        let pending = scenarioJson.steps.some(function (stepJson) {
            return stepJson.result.status === 'pending';
        });
        let failed = scenarioJson.steps.filter(function (stepJson) {
            return stepJson.result.status === 'failed';
        });

        if (passed === true) {
            //
        }
        else if (pending === true) {
            let feature = scenarioJson.id.split(';')[0];
            let scenario = scenarioJson.name;
            // Step passed the filter, create skipped
            scenarioOutput.push(createPending(feature, scenario));
        }
        else if (failed.length > 0 ) {
            failed.forEach(function (stepJson) {
                let feature = scenarioJson.id.split(';')[0];
                let scenario = scenarioJson.name;
                // Step passed the filter, create failure
                scenarioOutput.push(createFailure(feature, scenario, stepJson));
            });
        }

        //counting scenario total time
        scenarioJson.steps.forEach(function (stepJson) {
            if (stepJson.result.duration) {
                // Convert from millisecond to seconds for Cucumber 3x
                let stepTime = stepJson.result.duration / 1000;
                scenarioOutput[0]._attr.time = scenarioOutput[0]._attr.time + stepTime;
            }
        })
    }

    return { testcase: scenarioOutput };
}

/**
 * Skips background steps and calls `convertScenario` each element
 */
function convertFeature(featureJson, options) {
    let featureOutput = [{
        _attr: {
            name: featureJson.name,
            time: 0,
            tests: 0,
            failures: 0,
            skipped: 0
        }
    }];

    if(options.prefix) {
        featureOutput[0]._attr.name = options.prefix + featureOutput[0]._attr.name;
    }

    if(featureJson.elements) {
        featureJson.elements
            .filter(function(scenarioJson) {
                return (scenarioJson.type !== 'background');
            })
            .map(function (scenarioJson) {
                // Scenario passed the filter, incrementing the counter
                featureOutput[0]._attr.tests += 1;
                let scenario = convertScenario(scenarioJson, options);

                if (scenario.testcase[1] && scenario.testcase[1].failure) {
                    featureOutput[0]._attr.failures += 1;
                }
                if (scenario.testcase[1] && scenario.testcase[1].skipped) {
                    featureOutput[0]._attr.skipped += 1;
                }

                //counting feature total time
                let scenarioTime = scenario.testcase[0]._attr.time;
                featureOutput[0]._attr.time = featureOutput[0]._attr.time + scenarioTime;

                featureOutput.push(scenario);
            });
    }

    return { testsuite: featureOutput };

}

/**
 * options:
 *  - indent - passed to the XML formatter, defaults to 4 spaces
 *  - stream - passed to the XML formatter
 *  - declaration - passed to the XML formatter
 *  - strict - if true, pending or undefined steps will be reported as failures
 *
 * @method exports
 * @param  {string} cucumberRaw  the Cucumber JSON report
 * @param  {object=} options     eg: {indent: boolean, strict: boolean, stream: boolean, declaration: {encoding: 'UTF-8'}}
 * @return {string} the JUnit XML report
 */
function cucumberJunit (cucumberRaw, options) {
    let cucumberJson,
        output = [];
    options = options || {};
    if (options.indent === undefined) {
        options.indent = '    ';
    }
    if (!options.declaration) {
        options.declaration = { encoding: 'UTF-8' };
    }

    if (cucumberRaw && cucumberRaw.toString().trim() !== '') {
        cucumberJson = JSON.parse(cucumberRaw);
        cucumberJson.forEach(function (featureJson) {
            output = output.concat(convertFeature(featureJson, options));
        });

        // If no items, provide something
        if (output.length === 0) {
            output.push( { testsuite: [] } );
        }
    }

    // wrap all <testsuite> elements in <testsuites> element
    return xml({ testsuites: output }, options);
}

module.exports = cucumberJunit;