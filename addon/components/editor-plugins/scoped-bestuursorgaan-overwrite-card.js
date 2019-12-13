import { warn } from '@ember/debug';
import Component from '@ember/component';
import EmberObject from '@ember/object';
import layout from '../../templates/components/editor-plugins/scoped-bestuursorgaan-overwrite-card';
import CardMixin from '@lblod/ember-rdfa-editor-generic-model-plugin-utils/mixins/card-mixin';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';
import { reads } from '@ember/object/computed';

export default Component.extend(CardMixin, {
  layout,
  currentSession: service(),
  store: service(),
  rdfaEditorScopedBestuursorgaanPlugin: service(),
  allowedClassifications: reads('rdfaEditorScopedBestuursorgaanPlugin.allowedBestuursorgaanClassifications'),

  card: 'editor-plugins/scoped-bestuursorgaan-overwrite-card',

  getBestuursorganen: task(function * (){
    let currentBestuurseenheid = yield this.currentSession.get('group');
    let query = {
      'filter[is-tijdsspecialisatie-van][bestuurseenheid][id]': currentBestuurseenheid.id,
      'include':'is-tijdsspecialisatie-van,is-tijdsspecialisatie-van.bestuurseenheid',
      'sort': '-binding-start'
    };
    let bestuursorganenInTijd = yield this.store.query('bestuursorgaan', query);
    bestuursorganenInTijd = bestuursorganenInTijd.filter(b => this.get('allowedClassifications').includes(b.get('isTijdsspecialisatieVan.classificatie.uri')));
    this.set('bestuursorganenInTijd', bestuursorganenInTijd);

  }).restartable(),

  didReceiveAttrs() {
    this._super(...arguments);
    this.get('getBestuursorganen').perform();
  },
  actions: {
    async refer(bestuursorgaanInTijd){
      if (bestuursorgaanInTijd.uri !== this.info.huidigBestuursorgaanInTijd) {
        this.hintsRegistry.removeHintsAtLocation(this.location, this.get('hrId'), 'editor-plugins/scoped-bestuursorgaan-card');
        const updatedLocation = this.hintsRegistry.updateLocationToCurrentIndex(this.hrId, this.location);
        const selection = this.editor.selectContext(updatedLocation, this.info.context);
        this.editor.update(selection, {
          set: {
            typeof: bestuursorgaanInTijd.rdfaBindings.class,
            resource: bestuursorgaanInTijd.get('uri'),
            innerHTML: `${bestuursorgaanInTijd.isTijdsspecialisatieVan.get('naam')}`
          }});
      }
    }
  }
});
