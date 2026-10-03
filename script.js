console.log("내 script.js 실행됨!");

const supabaseUrl = "https://dviihusxrbhrmvcwqryn.supabase.co";
const supabaseKey = "sb_publishable_mkYmk_u9tvmIiTH2ALP8Vg_cq4QlEJE";

const supabaseClient = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);

const cards = document.querySelectorAll(".draw-card");


// ====================
// 카드 뽑기
// ====================

cards.forEach(function(card, index) {

    card.addEventListener("click", async function() {

        console.log("카드 클릭됨!");

        // 이미 뽑은 카드면 무시
        if (card.classList.contains("selected")) {
            return;
        }

        // Supabase 함수 실행
        const { data, error } = await supabaseClient
            .rpc("draw_random_save", {
                p_card_number: index + 1
            });

        console.log("RPC 결과:", data);
        console.log("RPC 오류:", error);

        // 오류 발생
        if (error) {
            console.error("쪽지 뽑기 오류:", error);
            return;
        }

        // 남은 쪽지가 없음
        if (!data || data.length === 0) {
            alert("남은 쪽지가 없습니다!");
            return;
        }

        // 뽑힌 쪽지
        const selectedNote = data[0];

        // 화면에 내용 표시
        card.querySelector(".card-content").textContent =
            selectedNote.content;

        // 카드 선택 상태
        card.classList.add("selected");
        card.disabled = true;

    });

});


// ====================
// 초기화 버튼
// ====================

const resetButton = document.getElementById("reset-button");

resetButton.addEventListener("click", async function() {

    const { error } = await supabaseClient
        .from("save")
        .update({ picked: false,
                card_num: null })
        .neq("id", 0);

    if (error) {
        console.error("초기화 오류:", error);
        return;
    }

    // 카드 화면 초기화
    cards.forEach(function(card) {
        card.querySelector(".card-content").textContent = "❓";
        card.classList.remove("selected");
        card.disabled = false;
    });

    console.log("쪽지 초기화 완료!");

});


// ====================
// Supabase Realtime
// ====================

supabaseClient
    .channel("save-realtime")
    .on(
        "postgres_changes",
        {
            event: "UPDATE",
            schema: "public",
            table: "save"
        },
        function(payload) {

            console.log("DB 변경 감지:", payload);

            const changedSave = payload.new;

            // 쪽지가 뽑힌 경우
            if (
                changedSave.picked === true &&
                changedSave.card_num !== null
            ) {
                const cardIndex = changedSave.card_num - 1;
                const card = cards[cardIndex];

                if (card) {
                    card.querySelector(".card-content").textContent =
                        changedSave.content;

                    card.classList.add("selected");
                    card.disabled = true;
                }
        }

        // 초기화된 경우
        if (
            changedSave.picked === false &&
            changedSave.card_num === null
        ) {
            cards.forEach(function(card) {

                card.querySelector(".card-content").textContent = "❓";

                card.classList.remove("selected");

                card.disabled = false;

            });
        }
        }
    )
    .subscribe();