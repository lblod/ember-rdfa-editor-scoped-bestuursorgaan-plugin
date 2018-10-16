@lblod/ember-rdfa-editor-scoped-bestuursorgaan
==============================================================================

Plugin responsible for inserting bestuursorgaan, bestuurseenheden linked to
profile of user

Installation
------------------------------------------------------------------------------

```
ember install @lblod/ember-rdfa-editor-scoped-bestuursorgaan
```


Usage
------------------------------------------------------------------------------
Assumes user is logged in ACM/IDM with ember-acmidm-login service.

For bestuursorgaan insert the instructive:
```<span property="ext:scopedBestuursorgaanText">selecteer bestuursorgaan</span>```


Contributing
------------------------------------------------------------------------------

### Installation

* `git clone <repository-url>`
* `cd ember-rdfa-editor-scoped-bestuursorgaan`
* `npm install`

### Linting

* `npm run lint:hbs`
* `npm run lint:js`
* `npm run lint:js -- --fix`

### Running tests

* `ember test` – Runs the test suite on the current Ember version
* `ember test --server` – Runs the test suite in "watch mode"
* `ember try:each` – Runs the test suite against multiple Ember versions

### Running the dummy application

* `ember serve`
* Visit the dummy application at [http://localhost:4200](http://localhost:4200).

For more information on using ember-cli, visit [https://ember-cli.com/](https://ember-cli.com/).

License
------------------------------------------------------------------------------

This project is licensed under the [MIT License](LICENSE.md).
