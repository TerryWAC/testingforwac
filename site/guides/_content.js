/* Guide content. Edit here, then run:  node guides/_shell.js
 *
 * Keep it general — this is information about how UK mortgages work, not advice
 * about anyone's circumstances. Anything time-sensitive (rates, thresholds,
 * scheme availability) should be phrased so it stays true, or flagged as
 * needing a check.
 */
module.exports = [
{
  slug: 'how-much-deposit',
  short: 'How much deposit do you actually need?',
  title: 'How much deposit do you actually need?',
  description: 'The real minimum, why 5% and 10% cost very different amounts, and the costs people forget to budget for.',
  audience: 'first-time buyers',
  readingTime: 6,
  segment: 'first-time-buyer',
  ctaHeading: 'Not sure which side of a threshold you fall on?',
  ctaBody: 'Send me your numbers and I will tell you whether waiting a few months is worth it, or whether you are ready now.',
  body: `
      <p>
        The honest answer is that 5% is usually enough to buy — and that this is rarely the
        number worth aiming for. The gap between "can I get a mortgage" and "can I get a good
        mortgage" is where most of the money is.
      </p>

      <h2>The practical minimum</h2>
      <p>
        For most residential purchases, lenders work down to a 5% deposit. On a £200,000 home
        that is £10,000. There are lenders who go further with a guarantor or a family
        arrangement, and there are periods when very few lenders operate at 5% at all — it moves
        with the market.
      </p>
      <p>
        Buy-to-let is a different world. Expect to need at least 25%, and the lending decision
        rests on the rent the property will produce rather than mainly on your income.
      </p>

      <h2>Why the bands matter more than the minimum</h2>
      <p>
        Lenders price in bands of loan-to-value — the percentage of the property's value you are
        borrowing. Cross a band and the rate available to you improves, often noticeably.
      </p>
      <div class="table-scroll">
        <table>
          <caption class="visually-hidden">Deposit needed at each loan-to-value band on a £200,000 property</caption>
          <tr><th>Deposit</th><th>Loan to value</th><th>On a £200,000 home</th></tr>
          <tr><td>5%</td><td>95% LTV</td><td>£10,000</td></tr>
          <tr><td>10%</td><td>90% LTV</td><td>£20,000</td></tr>
          <tr><td>15%</td><td>85% LTV</td><td>£30,000</td></tr>
          <tr><td>25%</td><td>75% LTV</td><td>£50,000</td></tr>
          <tr><td>40%</td><td>60% LTV</td><td>£80,000</td></tr>
        </table>
      </div>
      <p>
        The step from 5% to 10% is usually the one that changes the monthly payment most. If you
        are at 8% and saving steadily, the maths on waiting three months is often compelling —
        and it is exactly the kind of thing worth running properly before you commit.
      </p>

      <div class="callout">
        <p>
          <strong>Worth knowing:</strong> the band is calculated on what the lender's valuer says
          the property is worth, not what you agreed to pay. If a valuation comes in below the
          asking price, your LTV rises and the deal you were quoted may no longer be available.
        </p>
      </div>

      <h2>The costs people forget</h2>
      <p>
        The deposit is the big number, but it is not the only one, and the others are almost
        always needed in cash rather than added to the loan:
      </p>
      <ul>
        <li><strong>Stamp Duty</strong> — first-time buyers pay nothing up to a threshold, but the relief disappears entirely above a cap. The <a href="../index.html#calculators">Stamp Duty calculator</a> works yours out.</li>
        <li><strong>Legal fees</strong> — conveyancing, searches and Land Registry costs.</li>
        <li><strong>Survey</strong> — the lender's valuation is for the lender, not for you. A fuller survey is a separate cost and, on an older property, usually worth it.</li>
        <li><strong>Product fees</strong> — many of the lowest rates carry an arrangement fee. Sometimes paying it saves money overall; sometimes it does not. It depends on the loan size.</li>
        <li><strong>Moving itself</strong> — removals, and the first month in a home that needs things.</li>
      </ul>

      <h2>Gifted deposits</h2>
      <p>
        Money from family is common and entirely acceptable to lenders, with conditions. They
        will want a letter from whoever gave it confirming it is a gift rather than a loan, and
        that they retain no interest in the property. Some lenders restrict who can gift —
        parents almost always, wider family sometimes, friends rarely.
      </p>
      <p>
        Tell your adviser about a gift at the start rather than halfway through. It changes which
        lenders are suitable, and finding out late costs time.
      </p>

      <h2>What lenders look at besides the deposit</h2>
      <p>
        A large deposit does not rescue a weak application on its own. Lenders also assess your
        income and how it is structured, your existing credit commitments, your credit history,
        and your regular spending. Two people with identical deposits and salaries can get very
        different answers.
      </p>

      <div class="callout">
        <p>
          <strong>Before you apply:</strong> get a copy of your credit file. It is the single most
          useful thing you can do, it costs nothing, and it means the first conversation starts
          from facts rather than guesses.
        </p>
      </div>
  `
},
{
  slug: 'when-to-remortgage',
  short: 'When should you start a remortgage?',
  title: 'When should you start a remortgage?',
  description: 'Why six months before your deal ends is the right moment, what the standard variable rate really costs, and how a product transfer differs.',
  audience: 'anyone whose fixed rate is ending',
  readingTime: 5,
  segment: 'remortgage',
  ctaHeading: 'When does your current deal end?',
  ctaBody: 'Tell me the month and I will start looking six months before, so nothing lapses onto a standard variable rate by accident.',
  body: `
      <p>
        Six months before your current deal ends. Not when it ends, and not when the lender
        writes to you — which is often too late to do anything useful with.
      </p>

      <h2>Why six months</h2>
      <p>
        Most mortgage offers stay valid for three to six months from the date they are issued.
        That means you can secure a rate early and still be under no obligation to take it. If
        rates fall between now and completion, you switch to the better one. If they rise, you
        have the earlier rate locked.
      </p>
      <p>
        The asymmetry is the point: starting early has an upside and effectively no downside.
        Starting late has only downside.
      </p>

      <h2>What happens if you do nothing</h2>
      <p>
        When a fixed or tracker deal ends, the mortgage does not end. It rolls onto the lender's
        standard variable rate — the SVR. The SVR is set by the lender, can change whenever they
        choose, and is almost always the most expensive rate that lender offers.
      </p>
      <p>
        People rarely roll onto the SVR deliberately. They roll onto it because the letter arrived
        during a busy month and it slipped. The cost of that oversight is usually hundreds of
        pounds a month, and it starts immediately.
      </p>

      <div class="callout">
        <p>
          <strong>If you are already on the SVR:</strong> it is not too late and there is nothing
          to be embarrassed about — it is the single most common situation people come to a broker
          with. There is usually no early repayment charge on an SVR, so you can move straight away.
        </p>
      </div>

      <h2>Product transfer or full remortgage?</h2>
      <p>There are two routes, and they are not the same thing:</p>
      <ul>
        <li>
          <strong>A product transfer</strong> keeps you with your existing lender on a new deal.
          It is quick, needs little paperwork, and often requires no new affordability assessment
          or valuation. But you are only choosing from that one lender's range.
        </li>
        <li>
          <strong>A remortgage</strong> moves the loan to a different lender. It takes longer and
          involves a full application and legal work, but it opens the whole market — and lets you
          borrow more, change the term, or move from interest-only to repayment at the same time.
        </li>
      </ul>
      <p>
        The right answer depends on the numbers, and sometimes the transfer genuinely wins once the
        costs of switching are counted. It is worth comparing both rather than assuming either.
      </p>

      <h2>Watch the early repayment charge</h2>
      <p>
        Leaving a deal before it ends usually triggers an early repayment charge, often a
        percentage of the outstanding balance that steps down each year. Occasionally the saving
        from moving early outweighs the charge — but that needs calculating, not guessing.
      </p>
      <p>
        Check the end date on your current deal rather than trusting memory. It is on your annual
        statement or in your original offer, and it is frequently not the date people think.
      </p>

      <h2>What changes the answer</h2>
      <p>
        A remortgage is a fresh assessment, so anything that has changed since you last applied
        matters: income, job type, new credit commitments, children, or a change in the property's
        value. Rising property values are the pleasant surprise here — they can move you into a
        lower loan-to-value band and a better rate without you doing anything at all.
      </p>
      <p>
        You can estimate where you stand with the <a href="../index.html#calculators">repayment
        calculator</a> before speaking to anyone.
      </p>
  `
},
{
  slug: 'self-employed-mortgages',
  short: 'Getting a mortgage when you are self-employed',
  title: 'Getting a mortgage when you are self-employed',
  description: 'How lenders actually assess self-employed income, what paperwork to have ready, and the tax decision that quietly costs people their mortgage.',
  audience: 'sole traders, company directors and contractors',
  readingTime: 7,
  segment: 'other',
  ctaHeading: 'Self-employed and not sure where you stand?',
  ctaBody: 'Send me the shape of your income and I will tell you which lenders will work with it, before any application touches your credit file.',
  body: `
      <p>
        Being self-employed does not make a mortgage hard. It makes lender choice matter far more
        than it does for someone on a payslip — because lenders disagree, substantially, about what
        your income even is.
      </p>

      <h2>How long you have been trading</h2>
      <p>
        The common expectation is two or three years of accounts. A meaningful number of lenders
        will consider one year, particularly where you were previously employed doing the same
        work. Fewer will look at less than a full year, and those cases usually need a strong
        deposit and a good explanation.
      </p>
      <p>
        If you are approaching a year of trading, it is often worth waiting for the accounts to be
        finalised rather than applying without them.
      </p>

      <h2>What counts as your income</h2>
      <p>This is where lenders diverge most, and where an adviser earns their keep.</p>

      <h3>Sole traders</h3>
      <p>
        Generally assessed on net profit, taken from your SA302 or tax calculation. Most lenders
        average the last two years; some use the most recent year if it is lower; a few will use
        the latest year even when it is higher, which matters if the business is growing.
      </p>

      <h3>Company directors</h3>
      <p>
        Usually salary plus dividends drawn. That is the standard approach — and it penalises anyone
        who leaves profit in the company for good commercial reasons. A smaller group of lenders
        will use salary plus your share of retained net profit instead, which can produce a
        dramatically higher figure for the same business.
      </p>

      <h3>Contractors</h3>
      <p>
        Some lenders will work from your day rate rather than your accounts — a common approach is
        day rate multiplied by the days you work in a week, multiplied by around 46 to 48 weeks.
        For a well-paid contractor this can be far more generous than accounts-based assessment,
        and it can be available with a much shorter trading history.
      </p>

      <div class="callout">
        <p>
          <strong>The practical point:</strong> the difference between the most and least generous
          lender, on exactly the same accounts, is frequently tens of thousands of pounds of
          borrowing. Nothing about your business changes — only who is looking at it.
        </p>
      </div>

      <h2>The tax decision that costs people mortgages</h2>
      <p>
        A good accountant minimises your taxable profit. A mortgage lender assesses you on your
        taxable profit. Those two goals point in opposite directions, and the conflict is invisible
        until you apply.
      </p>
      <p>
        If a purchase or remortgage is likely within the next two years, that is worth saying to
        your accountant before the returns are filed, not after. It does not mean paying more tax
        than you need to — it means making the decision knowing both consequences.
      </p>

      <h2>What to have ready</h2>
      <ul>
        <li><strong>SA302s or tax year overviews</strong> for the last two to three years, plus the matching tax year overviews from HMRC</li>
        <li><strong>Full accounts</strong>, ideally prepared by a qualified accountant — some lenders require a specific qualification</li>
        <li><strong>Business and personal bank statements</strong>, usually three to six months</li>
        <li><strong>Your accountant's details</strong>, as many lenders will ask them to certify figures directly</li>
        <li><strong>Contracts</strong>, if you are a contractor — current one plus evidence of renewals</li>
      </ul>

      <h2>One thing not to do</h2>
      <p>
        Do not apply to several lenders yourself to see who says yes. Each full application leaves
        a hard search on your credit file, and a cluster of them makes you look like someone being
        repeatedly declined — which then makes the next lender more cautious.
      </p>
      <p>
        The point of getting advice first is that the search happens once, in the right place.
      </p>
  `
}
];
