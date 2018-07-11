'use strict';

import expectThrow from '../node_modules/openzeppelin-solidity/test/helpers/expectThrow';
import expectEvent from '../node_modules/openzeppelin-solidity/test/helpers/expectEvent';

const BigNumber = web3.BigNumber;
const chai =require('chai');
chai.use(require('chai-bignumber')(BigNumber));
chai.use(require('chai-as-promised')); // Order is important
chai.should();

const BetMe = artifacts.require("BetMe");
const MockBetMe = artifacts.require("MockBetMe");
const UnpayableArbiter = artifacts.require("UnpayableArbiter");

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

async function assertBalanceDiff(callInfo, wantEtherDiff) {
	const etherBefore = web3.eth.getBalance(callInfo.address);

	const ret = await callInfo.func(...callInfo.args, {from: callInfo.address, gasPrice: callInfo.gasPrice});
	const gasUsed = new BigNumber(ret.receipt.gasUsed);

	const etherAfter = web3.eth.getBalance(callInfo.address);
	const etherUsed = gasUsed.mul(callInfo.gasPrice);
	etherAfter.sub(etherBefore).add(etherUsed).should.be.bignumber.equal(wantEtherDiff);
}

async function preconditionArbiterIsChoosenAndAgree(inst, acc, defaults) {
	defaults = defaults == null ? {} : defaults;
	if (! ('setPenaltyAmount' in defaults)) {defaults.setPenaltyAmount = true;};
	const arbiterAddress = 'arbiterAddress' in defaults ? defaults.arbiterAddress : acc.arbiter;
	const betAmount = 'betAmount' in defaults ? defaults.betAmount : web3.toWei('0.05');

	await inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
	const penaltyAmount = defaults.setPenaltyAmount ? ('penaltyAmount' in defaults ? defaults.penaltyAmount : web3.toWei('0.003')) : 0;
	if (defaults.setPenaltyAmount) {
		await inst.setArbiterPenaltyAmount(penaltyAmount, {from: acc.owner}).should.eventually.be.fulfilled;
	}
	await inst.setArbiterAddress(arbiterAddress, {from: acc.owner}).should.eventually.be.fulfilled;
	const agreedStateVersion = await inst.StateVersion();
	await inst.agreeToBecameArbiter(agreedStateVersion, {from: arbiterAddress, value: penaltyAmount}).should.eventually.be.fulfilled;
}

async function preconditionOpponentBetIsMade(inst, acc, defaults) {
	defaults = defaults == null ? {} : defaults;
	if (!('betAmount' in defaults)) {defaults.betAmount = web3.toWei('0.05');}
	if (!('arbiterAddress' in defaults)) {defaults.arbiterAddress = acc.arbiter;}
	if (!('opponentAddress' in defaults)) {defaults.opponentAddress = acc.opponent;}
	if (!('presetOpponentAddress' in defaults)) {defaults.presetOpponentAddress = true;}

	await preconditionArbiterIsChoosenAndAgree(inst, acc, defaults);
	await inst.setOpponentAddress(acc.opponent, {from: acc.owner}).should.be.eventually.fulfilled;

	const agreedStateVersion = await inst.StateVersion();
	if (defaults.presetOpponentAddress) {
		await inst.betAssertIsFalse(
			agreedStateVersion, 
			{from: defaults.opponentAddress, value: defaults.betAmount},
		).should.be.eventually.fulfilled;
	}

	await inst.IsOpponentBetConfirmed({from: acc.anyone}).should.be.eventually.true;
	await inst.OpponentAddress({from: acc.anyone}).should.be.eventually.equal(defaults.opponentAddress);
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

	it('should not allow change Deadline if not owner', async function() {
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
		const betAmount = web3.toWei('0.05');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const newPercent = web3.toWei('0.005');
		await this.inst.setArbiterFee(newPercent, {from: acc.owner}).should.eventually.be.fulfilled;
	});

	it('should allow to set arbiter address after bet is made', async function() {
		const betAmount = web3.toWei('0.05');
		await this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;

		await this.inst.setArbiterAddress(acc.anyone, {from: acc.owner}).should.eventually.be.fulfilled;
	});

	it('should allow owner set arbiter penalty wei amount and should increase state version number', async function() {
		const newValue = web3.toWei('0.005');
		await this.inst.setArbiterPenaltyAmount(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.ArbiterPenaltyAmount({from: acc.anyone}).should.eventually.be.bignumber.equal(newValue);
		await this.inst.StateVersion({from: acc.anyone}).should.eventually.be.bignumber.equal(1);
	});

	it('should not allow set arbiter penalty to its previews value', async function() {
		const newValue = web3.toWei('0.005');
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


	it('should not allow to change arbiter address after arbiter is confirmed', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc);

		await expectThrow(this.inst.setArbiterAddress(acc.anyone, {from: acc.owner}));
	});

	it('should not allow to change arbiter penalty amount after arbiter is confirmed', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc);

		const newPenaltyAmount = (await this.inst.ArbiterPenaltyAmount()) + 1;
		await expectThrow(this.inst.setArbiterPenaltyAmount(newPenaltyAmount, {from: acc.owner}));
	});

	it('should not allow to change arbiter fee percent after arbiter is confirmed', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc);

		const fee = web3.toWei('10.0'); // 10%
		await expectThrow(this.inst.setArbiterFee(fee, {from: acc.owner}));
	});

	it('should not allow to change deadline after arbiter is agreed', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc);
		const newValue = daysInFutureTimestamp(15);
		await expectThrow(this.inst.setDeadline(newValue, {from: acc.owner}));
	});

	it('should not allow to change assertion text after arbiter is agreed', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc);
		await expectThrow(this.inst.setAssertionText("some unique assertion text", {from: acc.owner}));
	});

	it('should not allow non-arbiter to call arbiterSelfRetreat', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc);
		await expectThrow(this.inst.arbiterSelfRetreat({from: acc.anyone}));
	});

	it('should not allow owner to call arbiterSelfRetreat', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc);
		await expectThrow(this.inst.arbiterSelfRetreat({from: acc.anyone}));
	});

	it('should allow arbiter to retreat before opponent accepted bet and take penalty amount back', async function() {
		const penaltyAmount = web3.toWei('0.04');
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc, {penaltyAmount});

		const gasPrice = 10;
		const arbiterRetreatCallInfo = {func: this.inst.arbiterSelfRetreat, args: [], address: acc.arbiter, gasPrice};
		await assertBalanceDiff(arbiterRetreatCallInfo, penaltyAmount);
		await this.inst.IsArbiterAddressConfirmed({from: acc.anyone}).should.be.eventually.false;
	});

	it('should allow arbiter to retreat when penalty amount is not set', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc, {setPenaltyAmount: false});

		const gasPrice = 10;
		const arbiterRetreatCallInfo = {func: this.inst.arbiterSelfRetreat, args: [], address: acc.arbiter, gasPrice};
		await assertBalanceDiff(arbiterRetreatCallInfo, web3.toWei('0'));
	});

	it('should not allow to retreat before agreed', async function() {
		const betAmount = web3.toWei('0.5');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const penaltyAmount = web3.toWei('0.03');
		await this.inst.setArbiterPenaltyAmount(penaltyAmount, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;

		await expectThrow(this.inst.arbiterSelfRetreat({from: acc.arbiter}));
	});

	it('should revert if unable to transfer ether to arbiter address', async function() {
		// Prepare to test
		const arbiter = await UnpayableArbiter.new(this.inst.address, {from: acc.owner});
		const betAmount = web3.toWei('0.05');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		const penaltyAmount = web3.toWei('0.003');
		await this.inst.setArbiterPenaltyAmount(penaltyAmount, {from: acc.owner}).should.eventually.be.fulfilled;
		await this.inst.setArbiterAddress(arbiter.address, {from: acc.owner}).should.eventually.be.fulfilled;
		await arbiter.agreeToBecameArbiter({from: acc.anyone, value: penaltyAmount}).should.eventually.be.fulfilled;
		// Test
		await expectThrow(arbiter.arbiterSelfRetreat({from: acc.arbiter}));
	});
});

contract('BetMe - choosing opponent', function(accounts) {
	const acc = {anyone: accounts[0], owner: accounts[1], opponent: accounts[2], arbiter: accounts[3]};

	beforeEach(async function () {
		this.inst = await BetMe.new(...constructorArgs(), {from: acc.owner},);
	});

	it('should allow owner to set opponent address even after arbiter is choosen', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc);
		await this.inst.setOpponentAddress(acc.opponent, {from: acc.owner}).should.be.eventually.fulfilled;
	});

	it('should allow anyone to became an opponent if owner not specified its address', async function() {
		const betAmount = web3.toWei('0.001');
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc, {betAmount});
		const agreedStateVersion = await this.inst.StateVersion();
		await this.inst.IsOpponentBetConfirmed({from: acc.anyone}).should.be.eventually.false;
		await this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.anyone, value: betAmount}).should.be.eventually.fulfilled;
		await this.inst.IsOpponentBetConfirmed({from: acc.anyone}).should.be.eventually.true;
		await this.inst.OpponentAddress({from: acc.anyone}).should.be.eventually.equal(acc.anyone);
	});

	it('should not bet if opponent did not sent any ether or sent to much or to few', async function() {
		const betAmount = web3.toWei('0.001');
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc, {betAmount});
		const agreedStateVersion = await this.inst.StateVersion();
		await expectThrow(this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.owner}));
		await expectThrow(this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.owner, value: web3.toWei('0.000999')}));
		await expectThrow(this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.owner, value: web3.toWei('0.0011')}));
	});

	it('should not bet if opponent sent wrong state version number', async function() {
		const betAmount = web3.toWei('0.001');
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc, {betAmount});
		const agreedStateVersion = await this.inst.StateVersion();
		await this.inst.setOpponentAddress(acc.opponent, {from: acc.owner}).should.be.eventually.fulfilled; // This changes state version

		await expectThrow(this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.owner, value: betAmount}));
	});

	it('should not allow opponent bet before owner bet', async function() {
		const agreedStateVersion = await this.inst.StateVersion();
		await expectThrow(this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.owner, value: 0}));
	});

	it('should not allow opponent bet before arbiter is choosen and agreed', async function() {
		const betAmount = web3.toWei('0.001');
		await this.inst.bet({from: acc.owner, value: betAmount}).should.be.eventually.fulfilled;
		await this.inst.setArbiterAddress(acc.arbiter, {from: acc.owner}).should.eventually.be.fulfilled;
		const agreedStateVersion = await this.inst.StateVersion();

		await expectThrow(this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.owner, value: betAmount}));
	});

	it('should allow predefined opponent to bet', async function() {
		const betAmount = web3.toWei('0.001');
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc, {betAmount});
		await this.inst.setOpponentAddress(acc.opponent, {from: acc.owner}).should.be.eventually.fulfilled;
		const agreedStateVersion = await this.inst.StateVersion();

		await this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.opponent, value: betAmount}).should.be.eventually.fulfilled;
		await this.inst.IsOpponentBetConfirmed({from: acc.anyone}).should.be.eventually.true;
		await this.inst.OpponentAddress({from: acc.anyone}).should.be.eventually.equal(acc.opponent);
	});

	it('should not allow anyone else to bet if have predefined opponent', async function() {
		const betAmount = web3.toWei('0.001');
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc, {betAmount});
		await this.inst.setOpponentAddress(acc.opponent, {from: acc.owner}).should.be.eventually.fulfilled;
		const agreedStateVersion = await this.inst.StateVersion();

		await expectThrow(this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.anyone, value: betAmount}));
	});

	it('should not allow owner to bet as opponent', async function() {
		const betAmount = web3.toWei('0.001');
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc, {betAmount});
		const agreedStateVersion = await this.inst.StateVersion();
		await this.inst.IsOpponentBetConfirmed({from: acc.anyone}).should.be.eventually.false;

		await expectThrow(this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.owner, value: betAmount}));
	});

	it('should not allow arbiter to bet as opponent', async function() {
		const betAmount = web3.toWei('0.001');
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc, {betAmount});
		const agreedStateVersion = await this.inst.StateVersion();
		await this.inst.IsOpponentBetConfirmed({from: acc.anyone}).should.be.eventually.false;

		await expectThrow(this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.arbiter, value: betAmount}));
	});

	it('should not allow change opponent address after bet is made', async function() {
		const betAmount = web3.toWei('0.001');
		await preconditionOpponentBetIsMade(this.inst, acc, {betAmount});
		await expectThrow(this.inst.setOpponentAddress(acc.anyone, {from: acc.owner}));
	});

	it('should not allow opponent bet twice', async function() {
		const betAmount = web3.toWei('0.001');
		await preconditionOpponentBetIsMade(this.inst, acc, {betAmount, opponentAddress: acc.opponent});
		const agreedStateVersion = await this.inst.StateVersion();

		await expectThrow(this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.opponent, value: betAmount}));
	});

	it('should not allow arbiter to retreat after opponent bet is made', async function() {
		const betAmount = web3.toWei('0.001');
		await preconditionOpponentBetIsMade(this.inst, acc, {betAmount});
		await expectThrow(this.inst.arbiterSelfRetreat({from: acc.arbiter}));
	});

	it('should not allow to change deadline after oponnet bet is made', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		const newValue = daysInFutureTimestamp(15);
		await expectThrow(this.inst.setDeadline(newValue, {from: acc.owner}));
	});

	it('should not allow to change assertion text after opponent bet is made', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await expectThrow(this.inst.setAssertionText("some unique assertion text", {from: acc.owner}));
	});
});

function newBetCase(inst, acc, opt) {
	let obj = {inst, opt, acc};
	obj.setArbiterFee = async function (_fee) {
		const feePercent = _fee == null ?	opt.feePercent : _fee;
		await this.inst.setArbiterFee(feePercent, {from: acc.owner}).should.eventually.be.fulfilled;
	};
	obj.bet = async function (_bet) {
		if (_bet != null) {opt.betAmount = _bet;}
		//const betAmount = _bet == null ?	opt.betAmount : _bet;
		await this.inst.bet({from: acc.owner, value: opt.betAmount}).should.eventually.be.fulfilled;
	};
	obj.setArbiterAddress = async function (_val) {
		const arbiterAddress = _val == null ?	acc.arbiter : _val;
		await this.inst.setArbiterAddress(arbiterAddress, {from: acc.owner}).should.eventually.be.fulfilled;
	};
	obj.setArbiterPenaltyAmount = async function (_val) {
		const penaltyAmount = _val == null ?	this.opt.penaltyAmount : _val;
		await this.inst.setArbiterPenaltyAmount(penaltyAmount, {from: acc.owner}).should.eventually.be.fulfilled;
	};
	obj.agreeToBecameArbiter = async function () {
		const penaltyAmount = await this.inst.ArbiterPenaltyAmount({from: acc.anyone});
		const arbiterAddress = await this.inst.ArbiterAddress({from: acc.anyone});
		const agreedStateVersion = await this.inst.StateVersion({from: acc.anyone});
		await this.inst.agreeToBecameArbiter(agreedStateVersion, {from: arbiterAddress, value: penaltyAmount}).should.eventually.be.fulfilled;
	};
	obj.betAssertIsFalse = async function () {
		const betAmount = await this.inst.currentBet({from: acc.anyone});
		const agreedStateVersion = await this.inst.StateVersion({from: acc.anyone});
		await this.inst.betAssertIsFalse(agreedStateVersion, {from: acc.opponent, value: betAmount}).should.eventually.be.fulfilled;
	};
	obj.agreeAssertionTrue = async function () {
		const arbiterAddress = await this.inst.ArbiterAddress({from: acc.anyone});
		await this.inst.agreeAssertionTrue({from: arbiterAddress}).should.eventually.be.fulfilled;
	};
	obj.agreeAssertionFalse = async function () {
		const arbiterAddress = await this.inst.ArbiterAddress({from: acc.anyone});
		await this.inst.agreeAssertionFalse({from: arbiterAddress}).should.eventually.be.fulfilled;
	};
	obj.agreeAssertionUnresolvable = async function () {
		const arbiterAddress = await this.inst.ArbiterAddress({from: acc.anyone});
		await this.inst.agreeAssertionUnresolvable({from: arbiterAddress}).should.eventually.be.fulfilled;
	};
	obj.setTimeAfterDeadline = async function () {
		const newValue = (await this.inst.Deadline()).add(3600);
		await this.inst.setTime(newValue, {from: acc.owner}).should.eventually.be.fulfilled;
	};
	return obj;
}

contract('BetMe - payout helpers', function(accounts) {
	const acc = {anyone: accounts[0], owner: accounts[1], opponent: accounts[2], arbiter: accounts[3]};

	beforeEach(async function () {
		this.inst = await BetMe.new(...constructorArgs(), {from: acc.owner},);
	});

	it('should return zero as owner payout before he made his bet', async function() {
		await this.inst.ownerPayout({from: acc.owner}).should.eventually.be.bignumber.zero;
	});

	it('should return zero as arbiter payout before arbiter fee is set', async function() {
		await this.inst.arbiterPayout({from: acc.owner}).should.eventually.be.bignumber.zero;
	});

	it('should be zero arbiter payout before owner bet is made', async function() {
		const testCase = newBetCase(this.inst, acc, {feePercent: web3.toWei('10.0')});
		await testCase.setArbiterFee();
		await this.inst.arbiterPayout({from: acc.owner}).should.eventually.be.bignumber.zero;
	});

	it('should be arbiter payout OWNER_BET * ARBITER_FEE% / 100 after arbiter fee and owner bet is set', async function() {
		const testCase = newBetCase(this.inst, acc, {
			feePercent: web3.toWei('10.0'),
			betAmount: web3.toWei('0.001'),
		});
		await testCase.setArbiterFee();
		await testCase.bet();

		const gotAmount = await this.inst.arbiterPayout({from: acc.owner});
		const wantAmount = web3.toWei('0.0001');
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('should not add arbiter penalty amount to payout amount unless arbiter sent ether', async function() {
		const testCase = newBetCase(this.inst, acc, {
			feePercent: web3.toWei('10.0'),
			betAmount: web3.toWei('0.001'),
			penaltyAmount: web3.toWei('0.1'),
		});
		await testCase.setArbiterFee();
		await testCase.setArbiterAddress();
		await testCase.bet();
		await testCase.setArbiterPenaltyAmount();

		const gotAmount = await this.inst.arbiterPayout({from: acc.owner});
		const wantAmount = web3.toWei('0.0001');
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('should add arbiter penalty amount to payout amount after arbiter agreed and sent ether', async function() {
		const testCase = newBetCase(this.inst, acc, {});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet(web3.toWei('0.001'));
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();

		const gotAmount = await this.inst.arbiterPayout({from: acc.owner});
		const wantAmount = web3.toWei('0.2001');
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('should add arbiter penalty amount to payout amount after arbiter voted assertion is true', async function() {
		const testCase = newBetCase(this.inst, acc, {});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet(web3.toWei('0.001'));
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();
		await testCase.betAssertIsFalse();
		await testCase.agreeAssertionTrue();

		const gotAmount = await this.inst.arbiterPayout({from: acc.owner});
		const wantAmount = web3.toWei('0.2001');
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('should add arbiter penalty amount to payout amount after arbiter voted assertion is false', async function() {
		const testCase = newBetCase(this.inst, acc, {});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet(web3.toWei('0.001'));
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();
		await testCase.betAssertIsFalse();
		await testCase.agreeAssertionFalse();

		const gotAmount = await this.inst.arbiterPayout({from: acc.owner});
		const wantAmount = web3.toWei('0.2001');
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('should not add arbiter fee to payout amount after arbiter voted assertion is unresolvable', async function() {
		const testCase = newBetCase(this.inst, acc, {});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet(web3.toWei('0.001'));
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();
		await testCase.betAssertIsFalse();
		await testCase.agreeAssertionUnresolvable();

		const gotAmount = await this.inst.arbiterPayout({from: acc.owner});
		const wantAmount = web3.toWei('0.2');
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('should not pay arbiter abything if he does not voted before deadline', async function() {
		this.inst = await MockBetMe.new(...constructorArgs(), {from: acc.owner},);
		const testCase = newBetCase(this.inst, acc, {});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet(web3.toWei('0.001'));
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();
		await testCase.betAssertIsFalse();
		await testCase.setTimeAfterDeadline();

		await this.inst.arbiterPayout({from: acc.anyone}).should.eventually.be.bignumber.equal(web3.toWei('0'));
	});


	it('should pay arbiter full amount after deadline if he voted for true before deadline', async function() {
		this.inst = await MockBetMe.new(...constructorArgs(), {from: acc.owner},);
		const testCase = newBetCase(this.inst, acc, {});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet(web3.toWei('0.001'));
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();
		await testCase.betAssertIsFalse();
		await testCase.agreeAssertionTrue();
		await testCase.setTimeAfterDeadline();

		const gotAmount = await this.inst.arbiterPayout({from: acc.anyone});
		const wantAmount = web3.toWei('0.2001');
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('should pay arbiter full amount after deadline if he voted for false before deadline', async function() {
		this.inst = await MockBetMe.new(...constructorArgs(), {from: acc.owner},);
		const testCase = newBetCase(this.inst, acc, {});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet(web3.toWei('0.001'));
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();
		await testCase.betAssertIsFalse();
		await testCase.agreeAssertionFalse();
		await testCase.setTimeAfterDeadline();

		const gotAmount = await this.inst.arbiterPayout({from: acc.anyone});
		const wantAmount = web3.toWei('0.2001');
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('should return an arbiter penalty amount after deadline if he voted for unresolvable before deadline', async function() {
		this.inst = await MockBetMe.new(...constructorArgs(), {from: acc.owner},);
		const testCase = newBetCase(this.inst, acc, {});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet(web3.toWei('0.001'));
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();
		await testCase.betAssertIsFalse();
		await testCase.agreeAssertionUnresolvable();
		await testCase.setTimeAfterDeadline();

		const gotAmount = await this.inst.arbiterPayout({from: acc.anyone});
		const wantAmount = web3.toWei('0.2');
		gotAmount.should.be.bignumber.equal(wantAmount);
	});


	it('should return zero as owner payout before bet', async function() {
		await this.inst.ownerPayout({from: acc.owner}).should.eventually.be.bignumber.zero;
	});

	it('should return bet amount as owner payout just after his bet', async function() {
		const betAmount = web3.toWei('0.001');
		await this.inst.bet({from: acc.owner, value: betAmount});
		await this.inst.ownerPayout({from: acc.owner}).should.eventually.be.bignumber.equal(betAmount);
	});

	it('ownerPayment should be equal to bet amount after arbiter agreed', async function() {
		const testCase = newBetCase(this.inst, acc, {betAmount: web3.toWei('0.001')});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet();
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();

		const gotAmount = await this.inst.ownerPayout({from: acc.anyone});
		const wantAmount = testCase.opt.betAmount;
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('ownerPayment should be equal to bet amount after opponent bet', async function() {
		const testCase = newBetCase(this.inst, acc, {betAmount: web3.toWei('0.001')});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet();
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();
		await testCase.betAssertIsFalse();

		const gotAmount = await this.inst.ownerPayout({from: acc.anyone});
		const wantAmount = testCase.opt.betAmount;
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('ownerPayment should be double bet amount minus arbiter fee after arbiter voted for true', async function() {
		const testCase = newBetCase(this.inst, acc, {betAmount: web3.toWei('0.001')});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet();
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();
		await testCase.betAssertIsFalse();
		await testCase.agreeAssertionTrue();

		const gotAmount = await this.inst.ownerPayout({from: acc.anyone});
		const wantAmount = web3.toWei('0.0019'); // 0.001 * 2 - (0.001 * 10.0%)
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('ownerPayment should be zero after arbiter voted for false', async function() {
		const testCase = newBetCase(this.inst, acc, {betAmount: web3.toWei('0.001')});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet();
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();
		await testCase.betAssertIsFalse();
		await testCase.agreeAssertionFalse();

		const gotAmount = await this.inst.ownerPayout({from: acc.anyone});
		const wantAmount = web3.toWei('0');
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('ownerPayment should be equal to bet amount after arbiter voted for unresolvable', async function() {
		const testCase = newBetCase(this.inst, acc, {betAmount: web3.toWei('0.001')});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet();
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();
		await testCase.betAssertIsFalse();
		await testCase.agreeAssertionUnresolvable();

		const gotAmount = await this.inst.ownerPayout({from: acc.anyone});
		const wantAmount = testCase.opt.betAmount;
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('should return full bet amount if arbiter failed to vote before deadline', async function() {
		this.inst = await MockBetMe.new(...constructorArgs(), {from: acc.owner},);
		const testCase = newBetCase(this.inst, acc, {});
		await testCase.setArbiterFee(web3.toWei('10.0'));
		await testCase.setArbiterAddress();
		await testCase.bet(web3.toWei('0.001'));
		await testCase.setArbiterPenaltyAmount(web3.toWei('0.2'));
		await testCase.agreeToBecameArbiter();
		await testCase.betAssertIsFalse();
		await testCase.setTimeAfterDeadline();

		const gotAmount = await this.inst.ownerPayout({from: acc.anyone});
		const wantAmount = testCase.opt.betAmount;
		gotAmount.should.be.bignumber.equal(wantAmount);
	});

	it('should return full bet amount after deadline if no arbiter and opponent been set', async function() {
		this.inst = await MockBetMe.new(...constructorArgs(), {from: acc.owner},);
		const testCase = newBetCase(this.inst, acc, {betAmount: web3.toWei('0.001')});
		await testCase.bet();
		await testCase.setTimeAfterDeadline();

		const gotAmount = await this.inst.ownerPayout({from: acc.anyone});
		const wantAmount = testCase.opt.betAmount;
		gotAmount.should.be.bignumber.equal(wantAmount);
	});


});

contract('BetMe - bet resolve and withdrawal', function(accounts) {
	const acc = {anyone: accounts[0], owner: accounts[1], opponent: accounts[2], arbiter: accounts[3]};

	beforeEach(async function () {
		this.inst = await BetMe.new(...constructorArgs(), {from: acc.owner},);
	});

	it('should allow an arbiter to deside assertion is true', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.ArbiterHasVoted({from: acc.arbiter}).should.be.eventually.false;
		await this.inst.agreeAssertionTrue({from: acc.arbiter}).should.be.eventually.fulfilled;
		await this.inst.ArbiterHasVoted({from: acc.arbiter}).should.be.eventually.true;
	});

	it('should flag that decision is made after call to agreeAssertionTrue', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.IsDecisionMade({from: acc.arbiter}).should.be.eventually.false;
		await this.inst.agreeAssertionTrue({from: acc.arbiter}).should.be.eventually.fulfilled;
		await this.inst.IsDecisionMade({from: acc.arbiter}).should.be.eventually.true;
	});

	it('should flag that assertion is considered true after call to agreeAssertionTrue', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.IsAssertionTrue({from: acc.arbiter}).should.be.eventually.false;
		await this.inst.agreeAssertionTrue({from: acc.arbiter}).should.be.eventually.fulfilled;
		await this.inst.IsAssertionTrue({from: acc.arbiter}).should.be.eventually.true;
	});

	it('should let arbiter to withdraw penalty amount after successful agreeAssertionTrue', async function() {
		// FIXME: arbiter should withdraw penaltyAmount + fee
		const gasPrice = 10;
		const penaltyAmount = web3.toWei('0.002');
		await preconditionOpponentBetIsMade(this.inst, acc, {penaltyAmount});
		await this.inst.agreeAssertionTrue({from: acc.arbiter}).should.be.eventually.fulfilled;

		const callInfo = {func: this.inst.withdraw, args: [], address: acc.arbiter, gasPrice};
		await assertBalanceDiff(callInfo, penaltyAmount);
	});

	it('should let owner to withdraw double bet amount after successful agreeAssertionTrue', async function() {
		const gasPrice = 10;
		const betAmount = web3.toWei('0.003');
		await preconditionOpponentBetIsMade(this.inst, acc, {betAmount});
		await this.inst.agreeAssertionTrue({from: acc.arbiter}).should.be.eventually.fulfilled;

		const callInfo = {func: this.inst.withdraw, args: [], address: acc.owner, gasPrice};
		const wantWithdrawalAmount = (new web3.BigNumber(betAmount)).mul(2);
		await assertBalanceDiff(callInfo, wantWithdrawalAmount);
	});

	it('should not allow owner to withdraw twice', async function() {
		const betAmount = web3.toWei('0.001');
		const penaltyAmount = web3.toWei('0.006'); // more then bet amount to ensure owner withdraw will not revert due to insufficient funds
		await preconditionOpponentBetIsMade(this.inst, acc, {betAmount, penaltyAmount});
		await this.inst.agreeAssertionTrue({from: acc.arbiter}).should.be.eventually.fulfilled;
		await this.inst.withdraw({from: acc.owner}).should.be.eventually.fulfilled;
		await expectThrow(this.inst.withdraw({from: acc.owner}));
		await expectThrow(this.inst.withdraw({from: acc.owner})); // we test same call twice 
	});

	it('should not allow arbiter to withdraw twice', async function() {
		const betAmount = web3.toWei('0.006');
		const penaltyAmount = web3.toWei('0.001');
		await preconditionOpponentBetIsMade(this.inst, acc, {betAmount, penaltyAmount});
		await this.inst.agreeAssertionTrue({from: acc.arbiter}).should.be.eventually.fulfilled;
		await this.inst.withdraw({from: acc.arbiter}).should.be.eventually.fulfilled;
		await expectThrow(this.inst.withdraw({from: acc.arbiter}));
		await expectThrow(this.inst.withdraw({from: acc.arbiter})); // we test same call twice 
	});

	it('should not allow an opponent to withdraw if assertion considered true', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.agreeAssertionTrue({from: acc.arbiter}).should.be.eventually.fulfilled;
		await expectThrow(this.inst.withdraw({from: acc.opponent}));
	});

	it('should not allow owner to withdraw if assertion considered false', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.agreeAssertionFalse({from: acc.arbiter}).should.be.eventually.fulfilled;
		await expectThrow(this.inst.withdraw({from: acc.owner}));
	});

	it('should not allow owner, opponent, or anyone to call agreeAssertionTrue', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await expectThrow(this.inst.agreeAssertionTrue({from: acc.owner}));
		await expectThrow(this.inst.agreeAssertionTrue({from: acc.opponent}));
		await expectThrow(this.inst.agreeAssertionTrue({from: acc.anyone}));
	});

	it('should not allow an arbiter to deside assertion is true unless opponnet made his bet', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc);
		await expectThrow(this.inst.agreeAssertionTrue({from: acc.arbiter}));
	});

	it('should allow an arbiter to deside assertion is false', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.ArbiterHasVoted({from: acc.arbiter}).should.be.eventually.false;
		await this.inst.agreeAssertionFalse({from: acc.arbiter}).should.be.eventually.fulfilled;
		await this.inst.ArbiterHasVoted({from: acc.arbiter}).should.be.eventually.true;
	});

	it('should flag that decision is made after call to agreeAssertionFalse', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.IsDecisionMade({from: acc.arbiter}).should.be.eventually.false;
		await this.inst.agreeAssertionFalse({from: acc.arbiter}).should.be.eventually.fulfilled;
		await this.inst.IsDecisionMade({from: acc.arbiter}).should.be.eventually.true;
	});

	it('should flag that assertion is considered false before and after call to agreeAssertionFalse', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.IsAssertionTrue({from: acc.arbiter}).should.be.eventually.false;
		await this.inst.agreeAssertionFalse({from: acc.arbiter}).should.be.eventually.fulfilled;
		await this.inst.IsAssertionTrue({from: acc.arbiter}).should.be.eventually.false;
	});

	it('should not allow owner,opponent, or anyone else to call agreeAssertionFalse', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await expectThrow(this.inst.agreeAssertionFalse({from: acc.owner}));
		await expectThrow(this.inst.agreeAssertionFalse({from: acc.opponent}));
		await expectThrow(this.inst.agreeAssertionFalse({from: acc.anyone}));
	});

	it('should not allow an arbiter to call agreeAssertionFalse unless opponnet made his bet', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc);
		await expectThrow(this.inst.agreeAssertionFalse({from: acc.arbiter}));
	});

	it('should not allow an arbiter to call agreeAssertionFalse twice', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.agreeAssertionFalse({from: acc.arbiter}).should.eventually.be.fulfilled;
		await expectThrow(this.inst.agreeAssertionFalse({from: acc.arbiter}));
	});

	it('should not allow an arbiter to call agreeAssertionTrue twice', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.agreeAssertionTrue({from: acc.arbiter}).should.eventually.be.fulfilled;
		await expectThrow(this.inst.agreeAssertionTrue({from: acc.arbiter}));
	});

	it('should not allow an arbiter to call agreeAssertionTrue after agreeAssertionFalse', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.agreeAssertionFalse({from: acc.arbiter}).should.eventually.be.fulfilled;
		await expectThrow(this.inst.agreeAssertionTrue({from: acc.arbiter}));
	});

	it('should not allow an arbiter to call agreeAssertionFalse after agreeAssertionTrue', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.agreeAssertionTrue({from: acc.arbiter}).should.eventually.be.fulfilled;
		await expectThrow(this.inst.agreeAssertionFalse({from: acc.arbiter}));
	});

	it('should allow an arbiter to deside assertion is unresolvable', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.ArbiterHasVoted({from: acc.arbiter}).should.be.eventually.false;
		await this.inst.agreeAssertionUnresolvable({from: acc.arbiter}).should.be.eventually.fulfilled;
		await this.inst.ArbiterHasVoted({from: acc.arbiter}).should.be.eventually.true;
	});

	it('should flag decision is not made if arbiter voted with agreeAssertionUnresolvable', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.agreeAssertionUnresolvable({from: acc.arbiter}).should.be.eventually.fulfilled;
		await this.inst.IsDecisionMade({from: acc.arbiter}).should.be.eventually.false;
		await this.inst.IsAssertionTrue({from: acc.arbiter}).should.be.eventually.false;
	});

	it('should not allow owner, opponent, or anyone to call agreeAssertionUnresolvable', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await expectThrow(this.inst.agreeAssertionUnresolvable({from: acc.owner}));
		await expectThrow(this.inst.agreeAssertionUnresolvable({from: acc.opponent}));
		await expectThrow(this.inst.agreeAssertionUnresolvable({from: acc.anyone}));
	});

	it('should not allow to call agreeAssertionUnresolvable twice', async function() {
		await preconditionOpponentBetIsMade(this.inst, acc);
		await this.inst.agreeAssertionUnresolvable({from: acc.arbiter}).should.be.eventually.fulfilled;
		await expectThrow(this.inst.agreeAssertionUnresolvable({from: acc.arbiter}));
	});

	it('should not allow to call agreeAssertionUnresolvable unless opponent made his bet', async function() {
		await preconditionArbiterIsChoosenAndAgree(this.inst, acc);
		await expectThrow(this.inst.agreeAssertionUnresolvable({from: acc.arbiter}));
	});
});
