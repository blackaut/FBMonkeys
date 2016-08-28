var assert = require('chai').assert
var Player = require('../lib/_base/Player.js').Player;
var SquareCoordinate = require('../lib/_base/SquareCoordinate.js').SquareCoordinate;

var MutableObject = require("../lib/_base/utils/Utils.js").MutableObject;
var EffectJS = require("../lib/_base/Effect.js");
var EnableResourceEffect = EffectJS.EnableResourceEffect;

var CityTestUtilities = require("./utils/common.js").CityTestUtilities;

var CityPlayer = require('../lib/city/CityPlayer.js').CityPlayer;
var CityJS = require('../lib/city/City.js')
var City = CityJS.City;

var CityResource = require('../lib/city/CityResource.js').CityResource;

var CharacterOperationJS = require("../lib/city/CharacterOperation.js");
var EarnResourceForPlayerOperation = CharacterOperationJS.EarnResourceForPlayerOperation;
var CityCharacter = CharacterOperationJS.CityCharacter;

describe('Character Operations', () => {
	let time = 10;
	let amount = 100;
	let resource =  CityResource.gold(amount);
	let resources = [resource];
	let operation = new EarnResourceForPlayerOperation({
		time: time,
		resources: resources,
	});

	it('begins operation operation', () => {
		let player = CityTestUtilities.enabledCityPlayer();
		assert.instanceOf(operation, EarnResourceForPlayerOperation);
		let character = new CityCharacter({
			operations:[operation]
		});
		player.addCharacter(character);

		let updates = player.updateTime(time/2);
		assert.instanceOf(updates[0], EarnResourceForPlayerOperation);
		assert.strictEqual(updates.length, 1, "Began");

		let mutableCopy = MutableObject.mutableCopy(updates[0]);
		assert.instanceOf(mutableCopy, EarnResourceForPlayerOperation);
	});

	it('can complete an operation', () => {
		let player = CityTestUtilities.enabledCityPlayer();
		let character = new CityCharacter({
			operations:[operation]
		});
		player.addCharacter(character);

		let updates = player.updateTime(time);
		assert.instanceOf(updates[0], EarnResourceForPlayerOperation);
		assert.instanceOf(updates[1], EarnResourceForPlayerOperation);
		assert.instanceOf(updates[2], CityResource);
		assert.instanceOf(updates[3], EarnResourceForPlayerOperation);
		assert.strictEqual(updates.length, 4, "Began, Complete, Resource, Began");
	});

	it('can be completed partially', () => {
		let player = CityTestUtilities.enabledCityPlayer();
		let operations = new EarnResourceForPlayerOperation({
			time: time,
			resources: resources,
		});
		let character = new CityCharacter({
			operations:[operations]
		});

		player.addCharacter(character);

		let updates = player.updateTime(time/4.0);
		assert.instanceOf(updates[0], EarnResourceForPlayerOperation);
		assert.instanceOf(character.currentOperation, EarnResourceForPlayerOperation);
		assert.strictEqual(updates.length, 1, "Began");

		updates = player.updateTime(time/4.0);
		assert.strictEqual(updates.length, 0, "Nothing new");
		assert.instanceOf(character.currentOperation, EarnResourceForPlayerOperation);
		assert.isFalse(player.canAfford(resources));

		updates = player.updateTime(time/2);
		assert.instanceOf(updates[0], EarnResourceForPlayerOperation);
		assert.instanceOf(updates[1], CityResource);
		assert.instanceOf(updates[2], EarnResourceForPlayerOperation);
		assert.strictEqual(updates.length, 3, "Completed operation, Earned Resources, New operation");

		assert.isTrue(player.canAfford(resources));
	});

	it('do operations while allows', () => {
		let player = CityTestUtilities.enabledCityPlayer();
		let operations = new EarnResourceForPlayerOperation({
			time: time,
			resources: resources,
		});
		let character = new CityCharacter({
			operations:[operations]
		});

		player.addCharacter(character);

		let updates = player.updateTime(time * 20);

		/* Given the max this player can have Gold, the character will
		stop operating after the player has max allowed gold. */
		assert.strictEqual(updates.length, 3 * 10, "new completed, earned, completed 10 times (for total of 1000 gold)");
		assert.isNull(character.currentOperation);
		assert.strictEqual(player.getResourceAmountForType(resource.type), CityTestUtilities.maxResourceDefault);
	});

	it('choose highest-priotity operations first', () => {
		let resTypes = ['a', 'b', 'c']; /* Allow a:100, b:200, c:300 */
		let allowedResources = resTypes.map(function(type, index) {
			return new CityResource(type, (index + 1) * 100);
		});

		let effecs = allowedResources.map(function(res) {
			return new EnableResourceEffect({
				type: res.type,
				amount: res.amount
			});
		});
		let player = new CityPlayer({ effects: effecs });

		let operations = resTypes.map(function(type) {
			return new EarnResourceForPlayerOperation({
				time: time,
				resources: [new CityResource(type, 100)],
			});
		});
		let character = new CityCharacter({
			operations:operations
		});
		player.addCharacter(character);

		let updates = player.updateTime(time);
		assert.strictEqual(updates.length, 4, "new, completed, earned and new again");
		let generatedResource = updates[2];
		assert.instanceOf(generatedResource, CityResource);
		assert.strictEqual(generatedResource.type, 'a');

		updates = player.updateTime(time);
		updates = player.updateTime(time);
		generatedResource = updates[1];
		assert.instanceOf(generatedResource, CityResource);
		assert.strictEqual(generatedResource.type, 'b'); /* We have 200 b. From now on this is unavailable */

		updates = player.updateTime(time);
		updates = player.updateTime(time);
		updates = player.updateTime(time);
		generatedResource = updates[1];
		assert.instanceOf(generatedResource, CityResource);
		assert.strictEqual(generatedResource.type, 'c'); /* We have 300 c */

		assert.strictEqual(character.currentOperation, null);
	});
});
