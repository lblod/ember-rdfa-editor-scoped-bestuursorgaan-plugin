@lblod/ember-rdfa-editor-scoped-bestuursorgaan-plugin
==============================================================================

Plugin responsible for inserting bestuursorgaan, bestuurseenheden linked to
profile of user. Within the context of a zitting.


Compatibility
------------------------------------------------------------------------------

* Ember.js v3.4 or above
* Ember CLI v2.13 or above
* Node.js v8 or above


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

See the [Contributing](CONTRIBUTING.md) guide for details.


License
------------------------------------------------------------------------------

This project is licensed under the [MIT License](LICENSE.md).
