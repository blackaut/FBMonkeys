var assert = require('chai').assert;
var SquareCoordinate = require('../lib/_base/SquareCoordinate.js').SquareCoordinate;

var MutableObject = require("../lib/_base/utils/Utils.js").MutableObject;

var EffectJS = require("../lib/_base/Effect.js");
var EnableResourceEffect = EffectJS.EnableResourceEffect;


var CityPlayer = require('../lib/city/CityPlayer.js').CityPlayer;
var CityJS = require('../lib/city/City.js')
var City = CityJS.City;

var CityResource = require('../lib/city/CityResource.js').CityResource;

var CharacterOperationJS = require("../lib/city/CharacterOperation.js");
var CityCharacter = CharacterOperationJS.CityCharacter;
var EarnResourceForPlayerOperation = CharacterOperationJS.EarnResourceForPlayerOperation;

var BuildingJS = require('../lib/city/Building.js');
var Building = BuildingJS.Building;
var CompleteBuildingOperation = CharacterOperationJS.CompleteBuildingOperation;

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
		let player = new CityPlayer();
		assert.instanceOf(operation, EarnResourceForPlayerOperation, "Began earning");
		let character = new CityCharacter({
			operations:[operation]
		});
		player.addCharacter(character);

		let updates = player.updateTime(time/2);
		assert.instanceOf(updates[0], EarnResourceForPlayerOperation, "Began earning");
		assert.strictEqual(updates.length, 1);
	});

	it('can be completed fully', () => {
		let player = new CityPlayer();
		let character = new CityCharacter({
			operations:[operation]
		});
		player.addCharacter(character);

		let updates = player.updateTime(time);
		assert.instanceOf(updates[0], EarnResourceForPlayerOperation, "Began earning");
		assert.isFalse(updates[0].completed, "Began earning");
		assert.instanceOf(updates[1], EarnResourceForPlayerOperation, "Completed earning");
		assert.isTrue(updates[1].completed, "Completed earning");
		assert.instanceOf(updates[2], CityResource);
		assert.instanceOf(updates[3], EarnResourceForPlayerOperation, "Began next earning");
		assert.strictEqual(updates.length, 4, "Began, Complete, Resource, Began");
	});

	it('can be completed partially', () => {
		let player = new CityPlayer();
		let operations = new EarnResourceForPlayerOperation({
			time: time,
			resources: resources,
		});
		let character = new CityCharacter({
			operations:[operations]
		});

		player.addCharacter(character);

		let updates = player.updateTime(time/4.0);
		assert.instanceOf(updates[0], EarnResourceForPlayerOperation, "Began earning");
		assert.instanceOf(character.currentOperation, EarnResourceForPlayerOperation);
		assert.strictEqual(updates.length, 1, "Began");

		updates = player.updateTime(time/4.0);
		assert.strictEqual(updates.length, 0, "Nothing new");
		assert.instanceOf(character.currentOperation, EarnResourceForPlayerOperation);
		assert.isFalse(player.canAfford(resources));

		updates = player.updateTime(time/2.0);

		assert.instanceOf(updates[0], EarnResourceForPlayerOperation, "Completed earning");
		assert.instanceOf(updates[1], CityResource);
		assert.instanceOf(updates[2], EarnResourceForPlayerOperation, "Began next earning");
		assert.strictEqual(updates.length, 3, "Completed, Earned Resources, New");

		assert.isTrue(player.canAfford(resources));
	});

	it('choose enabled operations only', () => {
		let resTypes = ['a', 'b', 'c']; /* Allow a lot of a, b, and c */
		let effecs = resTypes.map(function(type) {
			return new EnableResourceEffect({
				type: type,
				amount: 10000
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

		let updates = player.updateTime(0.1);
		/* Began earning a */
		assert.instanceOf(character.currentOperation, EarnResourceForPlayerOperation);
		assert.strictEqual(character.currentOperation.resources[0].type, resTypes[0]);
		operations[0].disable();

		/* Finish a, but move to b now, because a is disabled */
		updates = player.updateTime(time);
		assert.strictEqual(updates.length, 3, "completed 'a', earned 'a' and began 'b'");
		let generatedResource = updates[1];
		assert.instanceOf(generatedResource, CityResource);
		assert.strictEqual(generatedResource.type, resTypes[0]);
		/* We are making b now */
		assert.instanceOf(character.currentOperation, EarnResourceForPlayerOperation);
		assert.strictEqual(character.currentOperation.resources[0].type, resTypes[1]);
		operations[0].enable();
		/* Finish b, but move to a now, because a is enabled */
		updates = player.updateTime(time);
		generatedResource = updates[1];
		assert.instanceOf(generatedResource, CityResource);
		assert.strictEqual(generatedResource.type, resTypes[1]);
		/* We are back to making a */
		/* We are making b now */
		assert.instanceOf(character.currentOperation, EarnResourceForPlayerOperation);
		assert.strictEqual(character.currentOperation.resources[0].type, resTypes[0]);
	});


	it('can change priority', () => {
		let resTypes = ['a', 'b', 'c', 'd']; /* Allow a lot of a, b, c and d */
		let effecs = resTypes.map(function(type) {
			return new EnableResourceEffect({
				type: type,
				amount: amount
			});
		});
		let player = new CityPlayer({ effects: effecs });

		let operations = resTypes.map(function(type) {
			return new EarnResourceForPlayerOperation({
				time: time,
				resources: [new CityResource(type, amount)],
			});
		});
		let character = new CityCharacter({
			operations:operations
		});
		player.addCharacter(character);

		character.setOperationPriority(operations[0], 0); /* a is now Top priority, top of the list */
		character.setOperationPriority(operations[1], 0); /* Now b is now Top priority, top of the list */
		character.setOperationPriority(operations[2], 0); /* c is now */
		character.setOperationPriority(operations[3], 1); /* d is second priority */

		operations[2].disable();
		let prioritized2 = character.prioritizedAvailableOperations({player:player});
		operations[2].enable();
		let prioritized1 = character.prioritizedAvailableOperations({player:player});

		assert.deepEqual(
			prioritized1, [operations[2], operations[3], operations[1], operations[0]]
		);
		assert.deepEqual(
			prioritized2, [operations[3], operations[1], operations[0]]
		);
	});

	it("builds buldings if required", () => {
		let player = new CityPlayer();
		let character = new CityCharacter({
			operations:[new CompleteBuildingOperation({
				time: time,
				amount: 1
			})]
		});
		player.addCharacter(character);

		let construction = 10;
		let building = new Building({
			costs: [ CityResource.construction(construction)],
		});
		player.city.addBuilding({
			building: building,
			location: new SquareCoordinate(-1,0)
		});

		let updates = player.updateTime(time);
		assert.strictEqual(Math.round(100*building.progress()), Math.round(100.0*(1.0/construction)));
		assert.instanceOf(updates[0], CompleteBuildingOperation, "Began incremental construction");
		assert.instanceOf(updates[1], CompleteBuildingOperation, "Finish incremental construcion");
		assert.instanceOf(updates[2], CityResource, "Constructed incrementally part the project (building)");
		assert.instanceOf(updates[3], CompleteBuildingOperation, "Began next construction");

		updates = player.updateTime(8*time);
		assert.isFalse(building.isCompleted());
		updates = player.updateTime(time);
		assert.isTrue(building.isCompleted());
		assert.isNull(character.currentOperation);
		assert.instanceOf(updates[0], CompleteBuildingOperation, "Completed building");
		assert.instanceOf(updates[1], CityResource, "Final incremental construction");
		assert.instanceOf(updates[2], Building);
	});
});
