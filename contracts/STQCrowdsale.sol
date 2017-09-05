pragma solidity 0.4.15;

import './ownership/multiowned.sol';
import './crowdsale/FixedTimeBonuses.sol';
import './crowdsale/FundsRegistry.sol';
import './STQToken.sol';
import 'zeppelin-solidity/contracts/ReentrancyGuard.sol';
import 'zeppelin-solidity/contracts/math/Math.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';


/// @title Storiqa ICO contract
// FIXME WARNING: dont use it, it was't tested and audited yet
contract STQCrowdsale is multiowned, ReentrancyGuard {
    using Math for uint256;
    using SafeMath for uint256;
    using FixedTimeBonuses for FixedTimeBonuses.Data;

    uint internal constant MSK2UTC_DELTA = 3600 * 3;

    enum IcoState { INIT, ICO, PAUSED, FAILED, SUCCEEDED }


    event StateChanged(IcoState indexed _state);


    modifier requiresState(IcoState _state) {
        require(m_state == _state);
        _;
    }

    /// @dev triggers some state changes based on current time
    modifier timedStateChange() {
        if (IcoState.INIT == m_state && now >= getStartTime())
            changeState(IcoState.ICO);
        if (IcoState.ICO == m_state && now > getEndTime())
            finishICO();

        _;
    }


    // PUBLIC interface

    function STQCrowdsale(address[] _owners, address _token, address _funds)
        multiowned(_owners, 2)
    {
        require(3 == _owners.length);
        require(address(0) != address(_token) && address(0) != address(_funds));

        m_token = STQToken(_token);
        m_funds = FundsRegistry(_funds);

        m_bonuses.bonuses.push(FixedTimeBonuses.Bonus({endTime: 1505768399 + MSK2UTC_DELTA, bonus: 25}));
        m_bonuses.bonuses.push(FixedTimeBonuses.Bonus({endTime: 1505941199 + MSK2UTC_DELTA, bonus: 20}));
        m_bonuses.bonuses.push(FixedTimeBonuses.Bonus({endTime: 1506200399 + MSK2UTC_DELTA, bonus: 15}));
        m_bonuses.bonuses.push(FixedTimeBonuses.Bonus({endTime: 1506545999 + MSK2UTC_DELTA, bonus: 10}));
        m_bonuses.bonuses.push(FixedTimeBonuses.Bonus({endTime: 1506891599 + MSK2UTC_DELTA, bonus: 5}));
        m_bonuses.bonuses.push(FixedTimeBonuses.Bonus({endTime: 1508360399 + MSK2UTC_DELTA, bonus: 0}));
        m_bonuses.validate(true);
    }


    // PUBLIC interface: payments

    // fallback function as a shortcut
    function() payable {
        buy();  // only internal call here!
    }

    /// @notice ICO participation
    /// @return number of STQ tokens bought (with all decimal symbols)
    function buy()
        public
        payable
        timedStateChange
        requiresState(IcoState.ICO)
        nonReentrant
        returns (uint)
    {
        // automatic check for unaccounted withdrawals
        if (maybeAutoPause()) {
            changeState(IcoState.PAUSED);
            msg.sender.transfer(msg.value);     // we cant throw (have to save state), so refunding this way
            return 0;
        }

        address investor = msg.sender;
        uint256 payment = msg.value;
        require(payment > 0);

        uint startingInvariant = this.balance.add(m_funds.balance);

        // checking for max cap
        uint fundsAllowed = c_MaximumFunds.sub(m_funds.totalInvested());
        assert(0 != fundsAllowed);  // in this case state must not be IcoState.ICO
        payment = fundsAllowed.min256(payment);
        uint256 change = msg.value.sub(payment);

        // issue tokens
        uint stq = calcSTQAmount(payment);
        m_token.mint(investor, stq);

        // record payment
        m_funds.invested.value(payment)(investor);

        // check if ICO must be closed early
        if (change > 0)
        {
            assert(c_MaximumFunds == m_funds.totalInvested());
            finishICO();

            // send change
            investor.transfer(change);
            assert(startingInvariant == this.balance.add(m_funds.balance).sub(change));
        }
        else
            assert(startingInvariant == this.balance.add(m_funds.balance));

        return stq;
    }


    // PUBLIC interface: owners: maintenance

    /// @notice pauses ICO
    function pause()
        external
        timedStateChange
        requiresState(IcoState.ICO)
        onlyowner
    {
        changeState(IcoState.PAUSED);
    }

    /// @notice resume paused ICO
    function unpause()
        external
        timedStateChange
        requiresState(IcoState.PAUSED)
        onlymanyowners(sha3(msg.data))
    {
        changeState(IcoState.ICO);
        checkTime();
    }

    /// @notice consider paused ICO as failed
    function fail()
        external
        timedStateChange
        requiresState(IcoState.PAUSED)
        onlymanyowners(sha3(msg.data))
    {
        changeState(IcoState.FAILED);
    }

    /// @notice In case we need to attach to existent token
    function setToken(address _token)
        external
        timedStateChange
        requiresState(IcoState.PAUSED)
        onlymanyowners(sha3(msg.data))
    {
        require(address(0) != _token);
        m_token = STQToken(_token);
    }

    /// @notice In case we need to attach to existent funds
    function setFundsRegistry(address _funds)
        external
        timedStateChange
        requiresState(IcoState.PAUSED)
        onlymanyowners(sha3(msg.data))
    {
        require(address(0) != _funds);
        m_funds = FundsRegistry(_funds);
    }

    /// @notice explicit trigger for timed state changes
    function checkTime()
        public
        timedStateChange
        onlyowner
    {
    }


    // INTERNAL functions

    function finishICO() private {
        if (m_funds.totalInvested() < c_MinFunds)
            changeState(IcoState.FAILED);
        else
            changeState(IcoState.SUCCEEDED);
    }

    /// @dev performs only allowed state transitions
    function changeState(IcoState _newState) private {
        assert(m_state != _newState);

        if (IcoState.INIT == m_state) {        assert(IcoState.ICO == _newState); }
        else if (IcoState.ICO == m_state) {    assert(IcoState.PAUSED == _newState || IcoState.FAILED == _newState || IcoState.SUCCEEDED == _newState); }
        else if (IcoState.PAUSED == m_state) { assert(IcoState.ICO == _newState || IcoState.FAILED == _newState); }
        else assert(false);

        m_state = _newState;
        // this should be tightly linked
        if (IcoState.SUCCEEDED == m_state) {
            onSuccess();
        } else if (IcoState.FAILED == m_state) {
            onFailure();
        }

        StateChanged(m_state);
    }

    function onSuccess() private {
        // mint tokens for owners
        uint tokensPerOwner = m_token.totalSupply().mul(4).div(m_numOwners);
        for (uint i = 0; i < m_numOwners; i++)
            m_token.mint(getOwner(i), tokensPerOwner);

        m_funds.changeState(FundsRegistry.State.SUCCEEDED);
        m_token.startCirculation();
    }

    function onFailure() private {
        m_funds.changeState(FundsRegistry.State.REFUNDING);
    }

    /// @dev automatic check for unaccounted withdrawals
    function maybeAutoPause() private returns (bool) {
        if (IcoState.SUCCEEDED == m_state || IcoState.FAILED == m_state)
            return false;   // expecting withdrawals

        if (m_funds.balance < m_lastFundsAmount)
            return true;

        m_lastFundsAmount = m_funds.balance;
        return false;
    }


    /// @dev calculates amount of STQ to which payer of _wei is entitled
    function calcSTQAmount(uint _wei) private constant returns (uint) {
        uint stq = _wei.mul(c_STQperETH);

        // apply bonus
        stq = stq.mul(m_bonuses.getBonus(now).add(100)).div(100);

        return stq;
    }

    /// @dev start time of the ICO, inclusive
    function getStartTime() private constant returns (uint) {
        return c_startTime;
    }

    /// @dev end time of the ICO, inclusive
    function getEndTime() private constant returns (uint) {
        return m_bonuses.getLastTime();
    }


    // FIELDS

    /// @notice starting exchange rate of STQ
    uint public constant c_STQperETH = 100;

    /// @notice minimum investments to consider ICO as a success
    uint public constant c_MinFunds = 1000 ether;

    /// @notice maximum investments to be accepted during ICO
    uint public constant c_MaximumFunds = 500000 ether;

    /// @notice start time of the ICO
    uint public constant c_startTime = 1505682000 + MSK2UTC_DELTA;

    /// @notice timed bonuses
    FixedTimeBonuses.Data m_bonuses;

    /// @dev state of the ICO
    IcoState public m_state = IcoState.INIT;

    /// @dev contract responsible for token accounting
    STQToken public m_token;

    /// @dev contract responsible for investments accounting
    FundsRegistry public m_funds;

    /// @dev last recorded funds
    uint256 public m_lastFundsAmount;
}
