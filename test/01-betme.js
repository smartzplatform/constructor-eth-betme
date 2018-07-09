'use strict';

import expectThrow from '../node_modules/openzeppelin-solidity/test/helpers/expectThrow';
import expectEvent from '../node_modules/openzeppelin-solidity/test/helpers/expectEvent';

const BigNumber = web3.BigNumber;
const chai =require('chai');
chai.use(require('chai-bignumber')(BigNumber));
chai.use(require('chai-as-promised')); // Order is important
chai.should();

const BetMe = artifacts.require("BetMe");

function daysInFutureTimestamp(days) {
	const now = new Date();
	const futureDate = new Date(+now + 86400 * days);
	return Math.trunc(futureDate.getTime()/1000);
}

const defaultAssertion = "Norman can light his Zippo cigarette lighter ten times in a row";
const defaultDeadlineDate = daysInFutureTimestamp(14);
const defaultArbiterFee = web3.toWei('1.5');
const zeroAddr = '0x0000000000000000000000000000000000000000';

function constructorArgs(defaults) {
	defaults = defaults == null ? {} : defaults;
	return [
		('Assertion' in defaults ? defaults.Assertion : defaultAssertion),
		('Deadline' in defaults ? defaults.Deadline : defaultDeadlineDate),
		('ArbiterFee' in defaults ? defaults.ArbiterFee : defaultArbiterFee),
		('ArbiterAddress' in defaults ? defaults.ArbiterAddress : zeroAddr),
		('OpponentAddress' in defaults ? defaults.OpponentAddress : zeroAddr),
	];
}

contract('BetMe - constructor and setters', function(accounts) {
	const acc = {anyone: accounts[0], owner: accounts[1], opponent: accounts[2], arbiter: accounts[3]};

	beforeEach(async function () {
		this.inst = await BetMe.new(...constructorArgs(), {from: acc.owner},);
	});

	it('should have initial stateVersion == 0', async function() {
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.zero;
	});

	it('should provide public getter for Assertion', async function() {
		await this.inst.Assertion({from: acc.anyone}).should.eventually.be.equal(defaultAssertion);
	});

	it('should provide public getter for Deadline', async function() {
		await this.inst.Deadline({from: acc.anyone}).should.eventually.be.bignumber.equal(defaultDeadlineDate);
	});

	it('should provide public getter for ArbiterFee', async function() {
		await this.inst.ArbiterFee({from: acc.anyone}).should.eventually.be.bignumber.equal(defaultArbiterFee);
	});

	it('should provide public getter for ArbiterAddress', async function() {
		await this.inst.ArbiterAddress({from: acc.anyone}).should.eventually.be.equal(zeroAddr);
	});

	it('should provide public getter for opponent address', async function() {
		await this.inst.OpponentAddress({from: acc.anyone}).should.eventually.be.equal(zeroAddr);
	});

	it('should not allow zero deadline in constructor', async function() {
		await expectThrow(BetMe.new(...constructorArgs({Deadline: 0}),  {from: acc.owner}));
	});

	it('should not allow deadline in the past in constructor', async function() {
		const fifteenMinutesAgo = daysInFutureTimestamp(0) - (15 * 30);
		await expectThrow(BetMe.new(...constructorArgs({Deadline: fifteenMinutesAgo}),  {from: acc.owner}));
	});

	it('should not allow empty assertion text in constructor', async function() {
		await expectThrow(BetMe.new(...constructorArgs({Assertion: ""}),  {from: acc.owner}));
	});

	it('should allow arbiter fee close to 100% in constructor', async function() {
		const maxOkFee = web3.toWei('99.9999');
		const inst = BetMe.new(...constructorArgs({ArbiterFee: maxOkFee}),  {from: acc.owner});
		await inst.should.be.eventually.fulfilled;
	});

	it('should not allow arbiter fee = 100% in constructor', async function() {
		const toMuchFee = web3.toWei('100.0');
		await expectThrow(BetMe.new(...constructorArgs({ArbiterFee: toMuchFee}),  {from: acc.owner}));
	});

	it('should not allow arbiter fee > 100% in constructor', async function() {
		const toMuchFee = web3.toWei('101.0');
		await expectThrow(BetMe.new(...constructorArgs({ArbiterFee: toMuchFee}),  {from: acc.owner}));
	});

	it('should not allow set Assertion text if not owner', async function() {
		await expectThrow(this.inst.setAssertionText("12345", {from: acc.anyone}));
	});

	it('should allow owner set Assertion text and increase state version number', async function() {
		const newAssertion = "square has four corners";
		await this.inst.setAssertionText(newAssertion, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.Assertion({from: acc.anyone}).should.eventually.be.equal(newAssertion);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should not allow owner set empty assertion text', async function() {
		await expectThrow(this.inst.setAssertionText("", {from: acc.owner}));
	});

	it('should not allow change Deadline text if not owner', async function() {
		await expectThrow(this.inst.setDeadline(daysInFutureTimestamp(15), {from: acc.anyone}));
	});

	it('should not allow set Deadline in past', async function() {
		const newValue = (await this.inst.Deadline()).sub(3600);
		await expectThrow(this.inst.setDeadline(newValue, {from: acc.owner}));
	});

	it('should allow owner set new Deadline and should increase state version number', async function() {
		const newValue = (await this.inst.Deadline()).add(3600);
		await this.inst.setDeadline(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.Deadline({from: acc.anyone}).should.eventually.be.bignumber.equal(newValue);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should not allow set ArbiterFee if not owner', async function() {
		const newValue = web3.toWei('10.5');
		await expectThrow(this.inst.setArbiterFee(newValue, {from: acc.anyone}));
	});

	it('should not allow set ArbiterFee = 100%', async function() {
		const newValue = web3.toWei('100');
		await expectThrow(this.inst.setArbiterFee(newValue, {from: acc.anyone}));
	});

	it('should allow owner set new ArbiterFee and should increase state version number', async function() {
		const newValue = web3.toWei('10');
		await this.inst.setArbiterFee(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.ArbiterFee({from: acc.anyone}).should.eventually.be.bignumber.equal(newValue);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should not allow set OpponentAddress if not owner', async function() {
		await expectThrow(this.inst.setOpponentAddress(acc.opponent, {from: acc.anyone}));
	});

	it('should allow owner set new opponent address and should increase state version number', async function() {
		const newValue = acc.opponent;
		await this.inst.setOpponentAddress(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.OpponentAddress({from: acc.anyone}).should.eventually.be.equal(newValue);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should allow owner set new opponent address and should increase state version number', async function() {
		const newValue = acc.opponent;
		await this.inst.setOpponentAddress(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.OpponentAddress({from: acc.anyone}).should.eventually.be.equal(newValue);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should allow set opponent address to address(0)', async function() {
		const inst = await BetMe.new(...constructorArgs({OpponentAddress: acc.opponent}),  {from: acc.owner});
		await inst.setOpponentAddress(zeroAddr, {from: acc.owner}).should.eventually.be.fulfilled;
		await inst.OpponentAddress({from: acc.anyone}).should.eventually.be.equal(zeroAddr);
	});

	it('should increase version for every modification', async function() {
		await this.inst.setOpponentAddress(acc.opponent, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.setOpponentAddress(zeroAddr, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(2);
	});

	it('should revert if setting opponent address to its previews value', async function() {
		await this.inst.setOpponentAddress(acc.opponent, {from: acc.owner}).should.eventually.be.fulfilled;
		await expectThrow(this.inst.setOpponentAddress(acc.opponent, {from: acc.owner}));
	});

	it('should not allow set ArbiterAddress if not owner', async function() {
		await expectThrow(this.inst.setArbiterAddress(acc.arbiter, {from: acc.anyone}));
	});

	it('should allow owner set arbiter address and should increase state version number', async function() {
		const newValue = acc.arbiter;
		await this.inst.setArbiterAddress(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.ArbiterAddress({from: acc.anyone}).should.eventually.be.equal(newValue);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should allow set arbiter address to address(0)', async function() {
		const inst = await BetMe.new(...constructorArgs({ArbiterAddress: acc.arbiter}),  {from: acc.owner});
		await inst.setArbiterAddress(zeroAddr, {from: acc.owner}).should.eventually.be.fulfilled;
		await inst.ArbiterAddress({from: acc.anyone}).should.eventually.be.equal(zeroAddr);
	});

	it('should revert if setting arbiter address to its previews value', async function() {
		await this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;
		await expectThrow(this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}));
	});

	it('should revert if setting arbiter address equal to owner address', async function() {
		await expectThrow(this.inst.setArbiterAddress(acc.owner, {from: acc.owner}));
	});
});

contract('BetMe - making bets', function(accounts) {
	const acc = {anyone: accounts[0], owner: accounts[1], opponent: accounts[2], arbiter: accounts[3]};

	beforeEach(async function () {
		this.inst = await BetMe.new(...constructorArgs(), {from: acc.owner},);
	});

	it('should revert if any non-owner calls bet', async function() {
		await expectThrow(this.inst.bet({from: acc.anyone, value: 0.5}));
	});

	it('should allow owner to make a bet', async function() {
		const betAmount = web3.toWei('0.05');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		await this.inst.currentBet({from: acc.anyone}).should.be.eventually.bignumber.equal(betAmount);
	});

	it('should allow make a bet only once', async function() {
		const betAmount = web3.toWei('0.05');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		await expectThrow(this.inst.bet({from: acc.owner, value: betAmount}));
	});

	it('should not allow set assertion text after bet is made', async function() {
		const betAmount = web3.toWei('0.05');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const newAssertion = "square has four corners";
		await expectThrow(this.inst.setAssertionText(newAssertion, {from: acc.owner}));
	});

});

contract('BetMe - choosing arbiter', function(accounts) {
	const acc = {anyone: accounts[0], owner: accounts[1], opponent: accounts[2], arbiter: accounts[3]};

	beforeEach(async function () {
		this.inst = await BetMe.new(...constructorArgs(), {from: acc.owner},);
	});

	it('should revert if non-owner try to set arbiter penalty amount', async function() {
		const newValue = web3.toWei('0.05');
		await expectThrow(this.inst.setArbiterPenaltyAmount(newValue, {from: acc.anyone}));
	});

	it('should allow to set arbiter fee percent after bet is made', async function() {
		const betAmount = web3.toWei('0.5');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const newPercent = web3.toWei('0.05');
		await this.inst.setArbiterFee(newPercent, {from: acc.owner}).should.eventually.be.fulfilled;
	});

	it('should allow to set arbiter address after bet is made', async function() {
		const betAmount = web3.toWei('0.5');
		await this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;

		await this.inst.setArbiterAddress(acc.anyone, {from: acc.owner}).should.eventually.be.fulfilled;
	});

	it('should allow owner set arbiter penalty wei amount and should increase state version number', async function() {
		const newValue = web3.toWei('0.05');
		await this.inst.setArbiterPenaltyAmount(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.ArbiterPenaltyAmount({from: acc.anyone}).should.eventually.be.bignumber.equal(newValue);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should not allow set arbiter penalty to its previews value', async function() {
		const newValue = web3.toWei('0.05');
		await this.inst.setArbiterPenaltyAmount(newValue, {from: acc.owner}).should.eventually.be.fulfilled;

		await expectThrow(this.inst.setArbiterPenaltyAmount(newValue, {from: acc.owner}));
	});

	it('should allow change arbiter penalty after owner bet is made', async function() {
		const betAmount = web3.toWei('0.5');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const newValue = web3.toWei('0.05');

		await this.inst.setArbiterPenaltyAmount(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
	});

	it('should not allow to became arbiter before arbiter address is set', async function() {
		const betAmount = web3.toWei('0.5');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const penaltyAmount = web3.toWei('0.03');
		await this.inst.setArbiterPenaltyAmount(penaltyAmount, {from: acc.owner}).should.eventually.be.fulfilled;

		const agreedStateVersion = await this.inst.StateVersion();
		await expectThrow(this.inst.agreeToBecameArbiter(agreedStateVersion, {from: acc.arbiter, value: penaltyAmount}));
	});

	it('should not allow to became arbiter before owner bet is made', async function() {
		const penaltyAmount = web3.toWei('0.03');
		await this.inst.setArbiterPenaltyAmount(penaltyAmount, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;

		const agreedStateVersion = await this.inst.StateVersion();
		await expectThrow(this.inst.agreeToBecameArbiter(agreedStateVersion, {from: acc.arbiter, value: penaltyAmount}));
	});

	it('should not allow non-arbiter-candidate to became an arbiter', async function() {
		const betAmount = web3.toWei('0.5');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const penaltyAmount = web3.toWei('0.03');
		await this.inst.setArbiterPenaltyAmount(penaltyAmount, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;

		const agreedStateVersion = await this.inst.StateVersion();
		await expectThrow(this.inst.agreeToBecameArbiter(agreedStateVersion, {from: acc.anyone, value: penaltyAmount}));
	});

	it('should allow arbiter candidate to became an arbiter', async function() {
		const betAmount = web3.toWei('0.5');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const penaltyAmount = web3.toWei('0.03');
		await this.inst.setArbiterPenaltyAmount(penaltyAmount, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.IsArbiterAddressConfirmed({from: acc.owner}).should.eventually.be.equal(false);
		const agreedStateVersion = await this.inst.StateVersion();

		await this.inst.agreeToBecameArbiter(agreedStateVersion, {from: acc.arbiter, value: penaltyAmount}).should.eventually.be.fulfilled;
		await this.inst.IsArbiterAddressConfirmed({from: acc.owner}).should.eventually.be.equal(true);
	});

	it('should not allow to became an arbiter if state has changed', async function() {
		const betAmount = web3.toWei('0.5');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const penaltyAmount = web3.toWei('0.03');
		await this.inst.setArbiterPenaltyAmount(penaltyAmount, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;
		const agreedStateVersion = await this.inst.StateVersion();
		await this.inst.setArbiterPenaltyAmount(web3.toWei('0'), {from: acc.owner}).should.eventually.be.fulfilled;

		await expectThrow(this.inst.agreeToBecameArbiter(agreedStateVersion, {from: acc.arbiter, value: penaltyAmount}));
	});

	it('should not allow arbiter candidate to became an arbiter twice', async function() {
		const betAmount = web3.toWei('0.5');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const penaltyAmount = web3.toWei('0.03');
		await this.inst.setArbiterPenaltyAmount(penaltyAmount, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;
		const agreedStateVersion = await this.inst.StateVersion();
		await this.inst.agreeToBecameArbiter(agreedStateVersion, {from: acc.arbiter, value: penaltyAmount}).should.eventually.be.fulfilled;

		await expectThrow(this.inst.agreeToBecameArbiter(agreedStateVersion, {from: acc.arbiter, value: penaltyAmount}));
	});

	async function preconditionArbiterIsChoosenAndAgree(inst) {
		const betAmount = web3.toWei('0.5');
		await inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const penaltyAmount = web3.toWei('0.03');
		await inst.setArbiterPenaltyAmount(penaltyAmount, {from: acc.owner}).should.eventually.be.fulfilled;
		await inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;
		const agreedStateVersion = await inst.StateVersion();
		await inst.agreeToBecameArbiter(agreedStateVersion, {from: acc.arbiter, value: penaltyAmount}).should.eventually.be.fulfilled;
	}

	it('should not allow to change arbiter address after arbiter is confirmed', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst);

		await expectThrow(this.inst.setArbiterAddress(acc.anyone, {from: acc.owner}));
	});

	it('should not allow to change arbiter penalty amount after arbiter is confirmed', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst);

		const newPenaltyAmount = (await this.inst.ArbiterPenaltyAmount()) + 1;
		await expectThrow(this.inst.setArbiterPenaltyAmount(newPenaltyAmount, {from: acc.owner}));
	});

	it('should not allow to change arbiter fee percent after arbiter is confirmed', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst);

		const fee = web3.toWei('10.0'); // 10%
		await expectThrow(this.inst.setArbiterFee(fee, {from: acc.owner}));
	});

	it('should not allow non-arbiter to call arbiterSelfRetreat', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst);
		await expectThrow(this.inst.arbiterSelfRetreat({from: acc.anyone}));
	});

	it('should not allow owner to call arbiterSelfRetreat', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst);
		await expectThrow(this.inst.arbiterSelfRetreat({from: acc.anyone}));
	});

	it('should arbiter to retreat before opponnet accepted bet', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst);
		await this.inst.arbiterSelfRetreat({from: acc.arbiter}).should.be.eventually.fulfilled;
		await this.inst.IsArbiterAddressConfirmed({from: acc.anyone}).should.be.eventually.false;
	});

	it('should not allow to retreat before agreed', async function() {
		const betAmount = web3.toWei('0.5');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const penaltyAmount = web3.toWei('0.03');
		await this.inst.setArbiterPenaltyAmount(penaltyAmount, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;

		await expectThrow(this.inst.arbiterSelfRetreat({from: acc.arbiter}));
	});

});
