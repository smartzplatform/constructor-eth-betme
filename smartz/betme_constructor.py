from smartz.api.constructor_engine import ConstructorInstance


class Constructor(ConstructorInstance):

    def get_version(self):
        return {
            "result": "success",
            "version": 1
        }

    def get_params(self):
        json_schema = {
            "type": "object",
            "required": [
                "assertion", "deadline"
            ],
            "additionalProperties": True,

            "properties": {
                "assertion": {
                    "title": "Assertion text",
                    "description": "You as owner of contract will bet this assertion is true, while your opponent will bet it is false. You can change this later, but just before you make a bet.",
                    "type": "string",
                    "minLength": 3,
                    "maxLength": 400,
                    "pattern": "^.+$"
                },
                "deadline": {
                    "title": "Deadline",
                    "description": "Dispute should be resolved before this point in time, otherwise no one considered a winner. Choose a date and time in the future, otherwise deploy will fail.",
                    "$ref": "#/definitions/unixTime",
                },
                "arbiterAddr": {
                    "title": "Arbiter address",
                    "description": "Arbiter decides is the assertion true, false or can not be checked. She gets the fee for judging and stakes deposit as a guarantee of motivation to get job done. When arbiter agrees to judge, contract's terms become inviolable.",
                    "$ref": "#/definitions/address"
                },
                "feePercent": {
                    "title": "Arbiter fee percent",
                    "description": "Arbiter fee as % of bet amount, should be in range [0-100). For example, if you bet for 1 ether and feePercent is 10, arbiter will receive 0.1 ether, and the winner will receive 0.9 ether.",
                    "$ref": "#/definitions/ethCount"
                },
                "opponentAddr": {
                    "title": "Opponent address",
                    "description": "Opponent bet for assertion is false. Leave this field blank to let anyone become an opponent.",
                    "$ref": "#/definitions/address"
                },
                "arbiterPenaltyAmount": {
                    "title": "Arbiter penalty amount",
                    "description": "Ether value to be sent by arbiter as a guarantee of his motivation and returned to him after he made decision.",
                    "$ref": "#/definitions/ethCount"
                },
            }
        }

        ui_schema = {
            "deadline": {
                "ui:widget": "unixTime",
            },
            "feePercent": {
                "ui:widget": "ethCount",
            },
            "arbiterPenaltyAmount": {
                "ui:widget": "ethCount",
            },
        }

        return {
            "result": "success",
            "schema": json_schema,
            "ui_schema": ui_schema
        }

    def construct(self, fields):
        zeroAddr = 'address(0)'
        arbiterAddr = fields.get('arbiterAddr', zeroAddr) or zeroAddr
        opponentAddr = fields.get('opponentAddr', zeroAddr) or zeroAddr
        feePercent = fields.get('feePercent', 0) or 0;
        arbiterPenaltyAmount = fields.get('arbiterPenaltyAmount', 0) or 0;

        source = self.__class__._TEMPLATE \
            .replace('%assertion%', fields['assertion']) \
            .replace('%deadline%', str(fields['deadline'])) \
            .replace('%feePercent%', str(feePercent)) \
            .replace('%arbiterAddr%', arbiterAddr) \
            .replace('%opponentAddr%', opponentAddr) \
            .replace('%arbiterPenaltyAmount%', str(arbiterPenaltyAmount)) \

        return {
            "result": "success",
            'source': source,
            'contract_name': "BetMeWrapper"
        }

    def post_construct(self, fields, abi_array):

        function_titles = {
             # View functions
            'Assertion': {
                'title': 'Assertion text',
                'description': 'Statement considered to be true by contract owner.',
                 'sorting_order': 10,
            },
            'Deadline': {
                'title': 'Deadline',
                'description': 'Current value of Deadline',
                "ui:widget": "unixTime",
                'sorting_order': 20,
            },
            'currentBet': {
                'title': 'Current bet amount',
                'description': 'Ether amount sent by contract owner to bet on assertion text is true',
                "ui:widget": "ethCount",
                'sorting_order': 30,
            },
            'OwnerAddress': {
                'title': 'Owner address',
                'description': 'Address of the bet contract owner. She deployed the contract, can change it\'s parameters before arbiter comes, and bet for assertion is true.',
                'sorting_order': 40,
            },
            'ArbiterAddress': {
                "title": "Arbiter address",
                "description": "Arbiter decides is the assertion true, false or can not be checked. She gets the fee for judging and stakes deposit as a guarantee of motivation to get job done. When arbiter agrees to judge, contract's terms become inviolable.",
                'sorting_order': 50,
            },
            'OpponentAddress': {
                "title": "Opponent address",
                "description": "Opponent bet for assertion is false. If this address set to 0x0000000000000000000000000000000000000000, anyone may become an opponent. Can bet only after arbiter agreed.",
                'sorting_order': 60,
            },
            'ArbiterFee': {
                'title': 'Arbiter fee percent',
                'description': 'Current value for arbiter fee as percent of bet amount',
                "ui:widget": "ethCount",
                'sorting_order': 70,
            },
            'ArbiterFeeAmountInEther': {
                'title': 'Arbiter fee in ether',
                'description': 'Calculated from bet amount and arbiter fee percent.',
                "ui:widget": "ethCount",
                'sorting_order': 80,
            },
            'ArbiterPenaltyAmount': {
                'title': 'Arbiter deposit amount',
                'description': 'Arbiter must freeze this amount as a incentive to judge this dispute.',
                "ui:widget": "ethCount",
                'sorting_order': 90,
            },
            'StateVersion': {
                "title": "State version number",
                "description": "Current state version number secures other participants from sudden changes in dispute terms by owner. Version changes every time owner edits the terms. Opponent and arbiter should specify which version do they mind when signing transactions to confirm their partaking in contract. If specified version not coincides with current, transaction reverts.",
                'sorting_order': 100,
            },
            'IsArbiterAddressConfirmed': {
                "title": "Arbiter agreed to judge",
                "description": "Arbiter has confirmed he is argee to judge this dispute with specific assertion text, deadline, bet, fee and penalty amount.",
                'sorting_order': 110,
            },
            'IsOpponentBetConfirmed': {
                "title": "Opponent confirmed his bet",
                "description": "Opponent made his bet opposite contract owner by transfering appropriate amount of ether to the smart contract.",
                'sorting_order': 120,
            },
            'ArbiterHasVoted': {
                "title": "Arbiter has made decision",
                "description": "Arbiter's decision can be one of: assertion is true, assertion is false, assertion can not be checked.",
                'sorting_order': 130,
            },
            'IsDecisionMade': {
                "title": "Arbiter considered assertion true or false",
                "description": "Arbiter confirmed that assertion is chacked and voted it is true or false.",
                'sorting_order': 140,
            },
            'IsAssertionTrue': {
                "title": "Assertion is true",
                "description": "Helper function for payouts calculations.",
                'sorting_order': 150,
            },
            'ownerPayout': {
                'title': 'Owner payout',
                'description': 'Amount of ether to be claimed by owner after dispute judged or failed.',
                "ui:widget": "ethCount",
                'sorting_order': 160,
            },
            'opponentPayout': {
                'title': 'Opponent payout',
                'description': 'Amount of ether to be claimed by opponent after dispute judged or failed.',
                "ui:widget": "ethCount",
                'sorting_order': 170,
            },
            'arbiterPayout': {
                'title': 'Arbiter payout',
                'description': 'Amount of ether to be claimed by arbiter after dispute judged or failed.',
                "ui:widget": "ethCount",
                'sorting_order': 180,
            },
            'IsOwnerTransferMade': {
                'title': 'Owner claimed payout',
                'description': 'Shows if an owner claimed his payout after dispute judged or failed.',
                'sorting_order': 190,
            },
            'IsOpponentTransferMade': {
                'title': 'Opponent claimed payout',
                'description': 'Shows if an owner claimed his payout after dispute judged or failed.',
                'sorting_order': 200,
            },
            'IsArbiterTransferMade': {
                'title': 'Arbiter claimed payout',
                'description': 'Shows if an owner claimed his payout after dispute judged or failed.',
                'sorting_order': 210,
            },
            'getTime': {
                'title': 'Current timestamp',
                'description': 'Just in case',
                "ui:widget": "unixTime",
                'sorting_order': 220,
            },
            # Write functions
            'setAssertionText': {
                'title': 'Change assertion text',
                'description': 'Only owner function. Can be called only before owner bet. Changes statement you bet to be true.',
                'inputs': [
                    {
                        'title': 'Assertion',
                        'description': 'Statement you bet to be true.'
                    },
                ],
                'sorting_order': 300,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'text'
                },
            },
            'setDeadline': {
                'title': 'Change deadline',
                'description': 'Only owner function. Can be called only before owner bet. Dispute should be resolved before this point in time, otherwise no one considered a winner. Choose a date and time in the future, otherwise transaction will fail.',
                'inputs': [
                    {
                        'title': 'new deadline',
                        'description': 'arbiter should be able to make decision before new deadline',
                        'ui:widget': 'unixTime'
                    },
                ],
                'sorting_order': 310,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'timer-sand'
                },
            },
            'setArbiterFee': {
                'title': 'Change arbiter fee percent',
                'description': 'Only owner function. Can be called only before arbiter agreed. Arbiter fee as % of bet amount, should be in range [0-100). For example, if you bet for 1 ether and feePercent is 10, arbiter will receive 0.1 ether, and the winner will receive 0.9 ether.',
                'inputs': [
                    {
                        'title': 'new fee percent [0,100.0)',
                        'description': 'change arbiter fee value before arbiter agreed to judge the dispute',
                        'ui:widget': 'ethCount'
                    },
                ],
                'sorting_order': 320,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'percent'
                },
            },
            'setArbiterPenaltyAmount': {
                'title': 'Change arbiter deposit',
                'description': 'Only owner function. Can be called only before arbiter agreed.',
                'inputs': [
                    {
                        'title': 'Deposit amount',
                        'description': 'Arbiter must freeze this amount as a incentive to judge this dispute.',
                        'ui:widget': 'ethCount'
                    },
                ],
                'sorting_order': 330,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'security-lock'
                },
            },
            'setArbiterAddress': {
                'title': 'Change arbiter address',
                'description': 'Only owner function. Can be called only before owner bet. Arbiter decides is the assertion true, false or can not be checked. She gets the fee for judging and stakes deposit as a guarantee of motivation to get job done. When arbiter agrees to judge, contract\'s terms become inviolable. Should be set before arbiter can agree, arbiter can not be random',
                'inputs': [
                    {
                        'title': 'Arbiter ethereum address',
                        'description': 'Arbiter ethereum address',
                    },
                ],
                'sorting_order': 340,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'security-account'
                },
            },
            'setOpponentAddress': {
                'title': 'Change opponnet address',
                'description': 'Only owner function. Can be called only before owner bet. Opponent bet for assertion is false.',
                'inputs': [
                    {
                        'title': 'Opponent address',
                        'description': 'Leave this field blank to let anyone become an opponent.',
                    },
                ],
                'sorting_order': 350,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'account-alert'
                },
            },
            'bet': {
                'title': 'Owner Bet',
                'description': 'Make owner bet',
                'payable_details': {
                    'title': 'Bet amount',
                    'description': 'Now you decide how much do you bet and accordingly how much your opponent should bet to take the challenge. Can not be changed.',
                },
                'sorting_order': 360,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'check-circle'
                },
            },
            'agreeToBecameArbiter': {
                'title': 'Agree to be an arbiter',
                'description': 'Only arbiter function. You agree to became an arbiter for this dispute and send penalty amount (if it is not set to zero by owner). When you agree, all contract\'s terms will freeze. You can self retreat before opponent bets.' ,
                'payable_details': {
                    'title': 'Arbiter deposit amount',
                    'description': 'Ether deposit amount (returned by "Arbiter deposit amount" function) to confim you are to freeze this ether as a guarantee you will judge the dispute. If you will not show, betters will split it.',
                },
                'inputs': [
                    {
                        'title': 'State version number',
                        'description': 'Returned by "State version number" function. This field secures you from sudden changes in dispute terms by owner. Version changes every time owner edits the terms. Opponent and arbiter should specify which version do they mind when signing transactions to confirm their partaking in contract. If specified version not coincides with current, transaction reverts.',
                    },
                ],
                'sorting_order': 370,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'check'
                },
            },
            'arbiterSelfRetreat': {
                'title': 'Arbiter self retreat',
                'description': 'Only arbiter function. After arbiter agreed but before opponent bet, arbiter may retreat and get her deposit back.',
                'sorting_order': 380,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'close'
                },
            },
            'betAssertIsFalse': {
                'title': 'Opponent Bet',
                'description': 'Make opponent bet for assertion text contains false statement',
                'payable_details': {
                    'title': 'Bet amount',
                    'description': 'Ether amount must be equal to owner bet as returned by "Current bet amount" (currentBet function)',
                },
                'inputs': [
                    {
                        'title': 'State version number',
                        'description': 'Returned by "State version number" function. This field secures you from sudden changes in dispute terms by owner. Version changes every time owner edits the terms. Opponent and arbiter should specify which version do they mind when signing transactions to confirm their partaking in contract. If specified version not coincides with current, transaction reverts.',
                    },
                ],
                'sorting_order': 390,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'alert-circle'
                },
            },
            'agreeAssertionTrue': {
                'title': 'Arbiter: assertion is True',
                'description': 'Only arbiter function. Arbiter confirm assertion text contains false statement (owner wins). After this function called, participants can claim their payouts.',
                'sorting_order': 400,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'comment-check-outline'
                },
            },
            'agreeAssertionFalse': {
                'title': 'Arbiter: assertion is False',
                'description': 'Only arbiter function. Arbiter confirm assertion text contains false statement (opponent wins). After this function called, participants can claim their payouts.',
                'sorting_order': 410,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'comment-remove-outline'
                },
            },
            'agreeAssertionUnresolvable': {
                'title': 'Arbiter: assertion can not be checked',
                'description': 'Only arbiter function. Arbiter affirms assertion can not be checked (everybody get their bets and deposits back). After this function called, participants can claim their payouts.',
                'sorting_order': 420,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'comment-question-outline'
                },
            },
            'withdraw': {
                'title': 'Get payout',
                'description': 'All participants of the contract claim their payouts with this function after dispute has ended.',
                'sorting_order': 430,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'currency-eth'
                },
            },
            'deleteContract': {
                'title': 'Drop contract',
                'description': 'Owner can drop the contract on some stages (for example, if there is no opponnet found).',
                'sorting_order': 440,
                'icon': {
                    'pack': 'materialdesignicons',
                    'name': 'delete'
                },
            },
        }

        return {
            "result": "success",
            'function_specs': function_titles,
            'dashboard_functions': ['Assertion', 'Deadline', 'currentBet', 'ArbiterHasVoted']
        }


    # language=Solidity
    _TEMPLATE = """
pragma solidity ^0.4.20;

library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
    // Gas optimization: this is cheaper than asserting 'a' not being zero, but the
    // benefit is lost if 'b' is also tested.
    // See: https://github.com/OpenZeppelin/openzeppelin-solidity/pull/522
    if (a == 0) {
      return 0;
    }

    c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    // uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return a / b;
  }

  /**
  * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
    c = a + b;
    assert(c >= a);
    return c;
  }
}

contract BetMe {
	using SafeMath for uint256;

	string public Assertion;
	uint256 public Deadline;
	uint256 public ArbiterFee;
	uint256 public ArbiterPenaltyAmount;

	uint256 public StateVersion;
	uint256 private betAmount;

	address public OwnerAddress;
	address public ArbiterAddress;
	address public OpponentAddress;

	bool public IsArbiterAddressConfirmed;
	bool public IsOpponentBetConfirmed;
	bool public ArbiterHasVoted;
	bool public IsDecisionMade;
	bool public IsAssertionTrue;
	bool public IsOwnerTransferMade;
	bool public IsArbiterTransferMade;
	bool public IsOpponentTransferMade;

	function BetMe(
		string  _assertion,
		uint256 _deadline,
		uint256 _fee,
		address _arbiterAddr,
		address _opponentAddr,
		uint256 _arbiterPenaltyAmount
	) public {
		OwnerAddress = msg.sender;
		_setAssertionText(_assertion);
		_setDeadline(_deadline);
		_setArbiterFee(_fee);
		ArbiterAddress  = _arbiterAddr;
		OpponentAddress = _opponentAddr;
		ArbiterPenaltyAmount = _arbiterPenaltyAmount;
	}

	modifier onlyOwner() {
		require(msg.sender == OwnerAddress);
		_;
	}

	modifier forbidOwner() {
		require(msg.sender != OwnerAddress);
		_;
	}

	modifier onlyArbiter() {
		require(msg.sender == ArbiterAddress);
		_;
	}

	modifier forbidArbiter() {
		require(msg.sender != ArbiterAddress);
		_;
	}

	modifier ensureTimeToVote() {
		require(IsVotingInProgress());
		_;
	}

	modifier onlyArbiterCandidate() {
		require(!IsArbiterAddressConfirmed);
		require(msg.sender == ArbiterAddress);
		_;
	}

	modifier increaseState() {
		StateVersion = StateVersion.add(1);
		_;
	}

	modifier whileBetNotMade() {
		require(betAmount == 0);
		_;
	}

	modifier requireOwnerBetIsMade() {
		require(betAmount != 0);
		_;
	}

	modifier requireArbiterNotConfirmed() {
		require(!IsArbiterAddressConfirmed);
		_;
	}

	modifier stateNumberMatches(uint256 _agreedState) {
		require(StateVersion == _agreedState);
		_;
	}

	modifier requireArbiterConfirmed() {
		require(IsArbiterAddressConfirmed);
		_;
	}

	modifier requireOpponentBetIsNotMade() {
		require(!IsOpponentBetConfirmed);
		_;
	}

	function IsVotingInProgress() internal view returns (bool) {
		return IsArbiterAddressConfirmed && IsOpponentBetConfirmed && !ArbiterHasVoted && getTime() < Deadline;
	}

	function IsArbiterLazyBastard() internal view returns (bool) {
		return (IsOpponentBetConfirmed && getTime() > Deadline && !ArbiterHasVoted);
	}

	function getTime() public view returns (uint256) {
		return now;
	}

	function setAssertionText(string _text) public onlyOwner increaseState whileBetNotMade {
		_setAssertionText(_text);
	}

	function _setAssertionText(string _text) internal {
		require(bytes(_text).length > 0);
		Assertion = _text;
	}

	function setDeadline(uint256 _timestamp) public onlyOwner increaseState requireArbiterNotConfirmed {
		_setDeadline(_timestamp);
	}

	function _setDeadline(uint256 _timestamp) internal {
		require(_timestamp > getTime());
		Deadline = _timestamp;
	}

	function setArbiterFee(uint256 _percent) public onlyOwner requireArbiterNotConfirmed increaseState {
		_setArbiterFee(_percent);
	}

	function _setArbiterFee(uint256 _percent) internal {
		require(_percent < 100e18); // 100.0% float as integer with decimal=18
		ArbiterFee      = _percent;
	}

	function setOpponentAddress(address _addr) public
		onlyOwner
		increaseState
		requireOpponentBetIsNotMade
	{
		require(_addr != address(OpponentAddress));
		require(_addr != address(OwnerAddress));
		require(_addr != address(ArbiterAddress) || _addr == address(0));
		OpponentAddress = _addr;
	}

	function setArbiterAddress(address _addr) public onlyOwner requireArbiterNotConfirmed increaseState {
		require(_addr != address(ArbiterAddress));
		require(_addr != address(OwnerAddress));
		require(_addr != address(OpponentAddress) || _addr == address(0));
		ArbiterAddress = _addr;
	}

	function bet() public payable onlyOwner whileBetNotMade {
		require(msg.value > 0);
		betAmount = msg.value;
	}

	function currentBet() public view returns (uint256) {
		return betAmount;
	}

	function setArbiterPenaltyAmount(uint256 _amount) public onlyOwner requireArbiterNotConfirmed increaseState {
		require(_amount != ArbiterPenaltyAmount);
		ArbiterPenaltyAmount = _amount;
	}

	function agreeToBecameArbiter(uint256 _agreedState) public payable
		onlyArbiterCandidate
		requireOwnerBetIsMade
		stateNumberMatches(_agreedState)
	{
		require(ArbiterAddress != address(0));
		require(msg.value == ArbiterPenaltyAmount);
		IsArbiterAddressConfirmed = true;
	}

	function arbiterSelfRetreat() public onlyArbiter requireArbiterConfirmed requireOpponentBetIsNotMade {
		uint256 _value = ArbiterPenaltyAmount;
		IsArbiterAddressConfirmed = false;
		ArbiterPenaltyAmount = 0;
		if (_value > 0 ) {
			ArbiterAddress.transfer(_value);
		}
	}

	function betAssertIsFalse(uint256 _agreedState) public payable
		requireOwnerBetIsMade
		forbidOwner
		requireArbiterConfirmed
		forbidArbiter
		stateNumberMatches(_agreedState)
		requireOpponentBetIsNotMade
	{
		require(msg.value == betAmount);
		if (OpponentAddress == address(0)) {
			OpponentAddress = msg.sender;
		} else {
			require(OpponentAddress == msg.sender);
		}
		IsOpponentBetConfirmed = true;
	}

	function agreeAssertionTrue() public onlyArbiter ensureTimeToVote {
		ArbiterHasVoted = true;
		IsDecisionMade = true;
		IsAssertionTrue = true;
	}

	function agreeAssertionFalse() public onlyArbiter ensureTimeToVote {
		ArbiterHasVoted = true;
		IsDecisionMade = true;
	}

	function agreeAssertionUnresolvable() public onlyArbiter ensureTimeToVote {
		ArbiterHasVoted = true;
	}

	function withdraw() public {
		require(ArbiterHasVoted || getTime() > Deadline);
		if (msg.sender == ArbiterAddress) {
			withdrawArbiter();
		} else if (msg.sender == OwnerAddress) {
			withdrawOwner();
		} else if (msg.sender == OpponentAddress) {
			withdrawOpponent();
		} else {
			revert();
		}
	}

	function withdrawArbiter() internal {
		require(!IsArbiterTransferMade);
		IsArbiterTransferMade = true;
		if (IsArbiterLazyBastard()) return;
		uint256 amount = IsArbiterAddressConfirmed ? ArbiterPenaltyAmount : 0;
		if (ArbiterHasVoted && IsDecisionMade) {
			amount = amount.add(ArbiterFeeAmountInEther());
		}
		if (amount > 0) ArbiterAddress.transfer(amount);
	}

	function withdrawOwner() internal {
		require(!IsDecisionMade || IsAssertionTrue);
		require(!IsOwnerTransferMade);
		IsOwnerTransferMade = true;
		OwnerAddress.transfer(ownerPayout());
	}

	function withdrawOpponent() internal {
		require(IsOpponentTransferPending());
		IsOpponentTransferMade = true;
		OpponentAddress.transfer(opponentPayout());
	}

	function ArbiterFeeAmountInEther() public view returns (uint256){
		return betAmount.mul(ArbiterFee).div(1e20);
	}

	function WinnerPayout() internal view returns (uint256) {
		return betAmount.mul(2).sub(ArbiterFeeAmountInEther());
	}

	function ownerPayout() public view returns (uint256) {
		if ( getTime() > Deadline && !ArbiterHasVoted && IsOpponentBetConfirmed) {
			return betAmount.add(ArbiterPenaltyAmount.div(2));
		}
		if (ArbiterHasVoted && IsDecisionMade) {
			return (IsAssertionTrue ? WinnerPayout() : 0);
		} else {
			return betAmount;
		}
	}

	function opponentPayout() public view returns (uint256) {
		if (getTime() > Deadline && !ArbiterHasVoted) {
			return betAmount.add(ArbiterPenaltyAmount.div(2));
		}
		if (ArbiterHasVoted && IsDecisionMade) {
			return (IsAssertionTrue ? 0 : WinnerPayout());
		}
		return IsOpponentBetConfirmed ? betAmount : 0;
	}

	function arbiterPayout() public view returns (uint256 amount) {
		if (IsArbiterLazyBastard()) return 0;
		if (!ArbiterHasVoted || IsDecisionMade) {
			amount = ArbiterFeeAmountInEther();
		}
		if (IsArbiterAddressConfirmed) {
			amount = amount.add(ArbiterPenaltyAmount);
		}
	}

	function IsOpponentTransferPending() internal view returns (bool) {
		if (IsOpponentTransferMade) return false;
		if (IsArbiterLazyBastard()) return true;
		if (ArbiterHasVoted && !IsAssertionTrue) return true;
		return false;
	}

	function deleteContract() public onlyOwner {
		require(!IsVotingInProgress());
		require(!IsOpponentTransferPending());
		if (IsArbiterAddressConfirmed && !IsArbiterTransferMade) {
			withdrawArbiter();
		}
		selfdestruct(OwnerAddress);
	}
}

contract BetMeWrapper is BetMe("%assertion%", %deadline%, %feePercent%, %arbiterAddr%, %opponentAddr%, %arbiterPenaltyAmount%){}
    """
