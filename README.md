@lblod/ember-rdfa-editor-scoped-bestuursorgaan-plugin
==============================================================================

Plugin responsible for inserting bestuursorgaan, bestuurseenheden linked to
profile of user. Within the context of a zitting.

Installation
------------------------------------------------------------------------------

```
ember install @lblod/ember-rdfa-editor-scoped-bestuursorgaan-plugin
```


Usage
------------------------------------------------------------------------------
Assumes user is logged in ACM/IDM with ember-acmidm-login service.

For bestuursorgaan insert the instructive in editor-document:
```
<span property="ext:scopedBestuursorgaanText">selecteer bestuursorgaan</span>
```

To set a reference to stand alone resoucre of bestuurseenheid.
```
<span property="ext:setStandAloneCurrentBestuurseenheid">huidig eenheid</span>
```
This will result in an automated update:
```
<span typeof="besluit:Bestuurseenheid" resource="http://uri"> naam bestuurseenheid </span>
```


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
