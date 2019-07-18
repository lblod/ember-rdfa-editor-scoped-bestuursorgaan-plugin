import Component from '@ember/component';
import serializeToJsonApi from '../../utils/serialize-to-json-api';
import layout from '../../templates/components/editor-plugins/scoped-bestuursorgaan-card';
import CardMixin from '@lblod/ember-rdfa-editor-generic-model-plugin-utils/mixins/card-mixin';

import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';

/**
* Card displaying a hint of the Scoped bestuursorgaan
*
* @module editor-scoped-bestuursorgaan-plugin
* @class ScopedBestuursorgaanCard
* @extends Ember.Component
*/
export default Component.extend(CardMixin, {
  metaModelQuery: service(),
  currentSession: service(),
  store: service(),

  layout,

  getBestuursorganen: task(function * (){
    let currentBestuurseenheid = yield this.currentSession.get('group');
    let properties = yield this.metaModelQuery.findPropertiesWithRange(this.get('info.domainUri'), 'http://data.vlaanderen.be/ns/besluit#BestuursOrgaan');

    //if multiple properties are found we want to display this in template
    if(properties.length > 1)
      this.set('displayProperties', true);

    let query = {
      'filter[is-tijdsspecialisatie-van][bestuurseenheid][id]': currentBestuurseenheid.id,
      'include':'is-tijdsspecialisatie-van,is-tijdsspecialisatie-van.bestuurseenheid',
      'sort': '-binding-start'
    };
    let bestuursorganenInTijd = yield this.store.query('bestuursorgaan', query);
    let bestuursorganenProperties = [];
    bestuursorganenInTijd.forEach(b => {
      properties.forEach(p => {
        bestuursorganenProperties.push({'b': b, 'p': p});
      });
    });
    this.set('bestuursorganenProperties', bestuursorganenProperties);

  }).restartable(),

  didReceiveAttrs() {
    this._super(...arguments);
    this.getBestuursorganen.perform();
  },

  actions: {
    async refer({b, p}){
      const bestuursorgaanInTijd = b;
      const predicate = p;
      this.hintsRegistry.removeHintsAtLocation(this.location, this.hrId, 'editor-plugins/scoped-bestuursorgaan-card');
      const updatedLocation = this.hintsRegistry.updateLocationToCurrentIndex(this.hrId, this.location);
      const selection = this.editor.selectContext(updatedLocation, this.info.context);
      this.editor.update(selection, {
        set: {
          typeof: bestuursorgaanInTijd.rdfaBindings.class,
          property: p.get('rdfaType'),
          resource: bestuursorgaanInTijd.get('uri'),
          innerHTML: `${bestuursorgaanInTijd.isTijdsspecialisatieVan.get('naam')}`
        }});
    }
  }
});
